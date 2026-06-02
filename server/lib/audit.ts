import { pool } from "../mysql.js";
import { Request } from "express";


export interface AuditLogOptions {
  userId: number | string | null;
  action: string;
  description?: string;
  targetType?: string;
  targetId?: string | number | null;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
  req?: Request; // Optional request object to auto-extract IP/UA
}

/**
 * Masks sensitive information in a string or object.
 */
export function maskSensitiveData(data: any): any {
  if (!data) return data;

  if (typeof data === 'string') {
    // Mask Names: John Smith -> Jo** Sm***
    const nameRegex = /^(\S{2})(\S+)\s+(\S{2})(\S+)$/;
    if (nameRegex.test(data)) {
        return data.replace(nameRegex, (match, p1, p2, p3, p4) => {
            return p1 + '*'.repeat(p2.length) + ' ' + p3 + '*'.repeat(p4.length);
        });
    }

    // Mask Single Names (Nickname): John -> Jo**
    const singleNameRegex = /^(\S{2})(\S+)$/;
    if (singleNameRegex.test(data)) {
        return data.replace(singleNameRegex, (match, p1, p2) => p1 + '*'.repeat(p2.length));
    }

    // Mask Phone: 08x-xxx-1234
    const phoneRegex = /^(\d{2})(\d+)(\d{4})$/;
    if (phoneRegex.test(data)) {
      return data.replace(phoneRegex, '$1x-xxx-$3');
    }
    
    // Mask Thai ID: x-xxxx-xxxxx-xx-x
    const idRegex = /^\d{13}$/;
    if (idRegex.test(data)) {
      return data.substring(0, 1) + '-xxxx-xxxxx-' + data.substring(11, 13) + '-' + data.substring(13);
    }

    // Mask Email: u***@domain.com
    const emailRegex = /^(.{1})(.*)(@.*)$/;
    if (emailRegex.test(data)) {
      return data.replace(emailRegex, '$1***$3');
    }

    return data;
  }

  if (typeof data === 'object') {
    const masked: any = Array.isArray(data) ? [] : {};
    for (const key in data) {
      const lowerKey = key.toLowerCase();
      
      // Fields to hide completely
      if (['password', 'token', 'access_token', 'refresh_token', 'credit_card', 'cvv', 'card_number'].some(k => lowerKey.includes(k))) {
        masked[key] = '[HIDDEN]';
        continue;
      }

      // Fields to mask
      if (['phone', 'tel', 'mobile'].some(k => lowerKey.includes(k))) {
        masked[key] = maskSensitiveData(data[key]);
        continue;
      }

      if (['email'].some(k => lowerKey.includes(k))) {
          masked[key] = maskSensitiveData(data[key]);
          continue;
      }

      if (['id_code', 'citizen_id'].some(k => lowerKey.includes(k))) {
          masked[key] = maskSensitiveData(data[key]);
          continue;
      }

      // Recursively mask nested objects
      if (typeof data[key] === 'object' && data[key] !== null) {
        masked[key] = maskSensitiveData(data[key]);
      } else {
        masked[key] = data[key];
      }
    }
    return masked;
  }

  return data;
}

/**
 * Logs an administrative or critical action to the audit_logs table.
 */
export async function logAudit(options: any, actionArg?: string, descriptionArg?: string, targetTypeArg?: string, targetIdArg?: string | number) {
  let userId: number | string | null = null;
  let action: string = 'unknown';
  let description: string | undefined = undefined;
  let targetType: string | undefined = undefined;
  let targetId: string | number | null = null;
  let metadata: any = null;
  let ipAddress: string | undefined = undefined;
  let userAgent: string | undefined = undefined;
  let req: Request | undefined = undefined;

  // Handle positional arguments if options is not an object
  if (typeof options !== 'object' || options === null) {
    userId = options;
    action = actionArg || 'unknown';
    description = descriptionArg;
    targetType = targetTypeArg;
    targetId = targetIdArg || null;
  } else {
    // Standard object syntax
    userId = options.userId;
    action = options.action || 'unknown';
    description = options.description;
    targetType = options.targetType;
    targetId = options.targetId;
    metadata = options.metadata;
    ipAddress = options.ipAddress;
    userAgent = options.userAgent;
    req = options.req;
  }

  // Auto-extract from req if provided
  const finalIp = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress || null) as string : (ipAddress || null);
  const finalUA = req ? req.headers['user-agent'] || null : (userAgent || null);

  let finalMetadata = metadata;
  if (req) {
    finalMetadata = {
      ...(finalMetadata || {}),
      method: req.method,
      url: req.originalUrl
    };
  }

  // Mask sensitive data
  const maskedMetadata = finalMetadata ? JSON.stringify(maskSensitiveData(finalMetadata)) : null;
  const maskedDescription = description || null;

  try {
    const [result] = await pool.query(
      `INSERT INTO audit_logs 
       (user_id, action, description, target_type, target_id, metadata, ip_address, user_agent) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId?.toString() || 'SYSTEM',
        action || 'unknown',
        maskedDescription,
        targetType || null,
        targetId?.toString() || null,
        maskedMetadata,
        finalIp,
        finalUA
      ]
    );
    return result;
  } catch (error: any) {
    // If user_agent column doesn't exist, try to fall back
    if (error.code === 'ER_BAD_FIELD_ERROR' && error.message.includes('user_agent')) {
        const [result] = await pool.query(
          `INSERT INTO audit_logs 
           (user_id, action, description, target_type, target_id, metadata, ip_address) 
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            userId?.toString() || 'SYSTEM',
            action,
            maskedDescription,
            targetType || null,
            targetId?.toString() || null,
            maskedMetadata,
            finalIp
          ]
        );
        return result;
    }
    
    console.error(`[AUDIT ERROR] Failed to log action ${action}:`, error.message);
    return null;
  }
}

/**
 * Cleanup logs older than specified days.
 */
export async function cleanupLogs(days: number = 90) {
    try {
        const [result]: any = await pool.query(
            'DELETE FROM audit_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [days]
        );
        console.log(`[AUDIT CLEANUP] Removed ${result.affectedRows} logs older than ${days} days.`);
        return result.affectedRows;
    } catch (error: any) {
        console.error('[AUDIT CLEANUP ERROR]', error.message);
        return 0;
    }
}
