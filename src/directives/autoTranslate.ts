import { watch } from 'vue'
import { langStore } from '../store/lang'

const translationCache = new Map<string, string>()

export async function getTranslation(text: string, from = 'th', to = 'en'): Promise<string> {
    if (!text) return ''
    const cacheKey = `${text}_${from}_${to}`
    if (translationCache.has(cacheKey)) return translationCache.get(cacheKey)!

    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(text)}`
        const res = await fetch(url)
        const data = await res.json()
        
        let result = ''
        if (data && data[0]) {
            data[0].forEach((item: any) => {
                if (item[0]) result += item[0]
            })
        }
        
        if (result) {
            translationCache.set(cacheKey, result)
            return result
        }
        return text
    } catch (error) {
        console.error('Translation error:', error)
        return text
    }
}

export const vAutoTranslate = {
    mounted(el: HTMLElement, binding: any) {
        (el as any)._text = binding.value;
        (el as any)._render = async () => {
            const text = (el as any)._text;
            if (!text) { 
                el.textContent = ''; 
                return; 
            }
            if (langStore.locale === 'th') { 
                el.textContent = text; 
                return; 
            }
            // Fetch translation
            const translated = await getTranslation(text, 'th', 'en');
            el.textContent = translated;
        };
        (el as any)._stopWatch = watch(() => langStore.locale, (el as any)._render, { immediate: true });
    },
    updated(el: HTMLElement, binding: any) {
        if ((el as any)._text !== binding.value) {
            (el as any)._text = binding.value;
            (el as any)._render();
        }
    },
    unmounted(el: HTMLElement) {
        if ((el as any)._stopWatch) {
            (el as any)._stopWatch();
        }
    }
};

export const vAutoTranslateTitle = {
    mounted(el: HTMLElement, binding: any) {
        (el as any)._titleText = binding.value;
        (el as any)._renderTitle = async () => {
            const text = (el as any)._titleText;
            if (!text) { 
                el.title = ''; 
                return; 
            }
            if (langStore.locale === 'th') { 
                el.title = text; 
                return; 
            }
            const translated = await getTranslation(text, 'th', 'en');
            el.title = translated;
        };
        (el as any)._stopWatchTitle = watch(() => langStore.locale, (el as any)._renderTitle, { immediate: true });
    },
    updated(el: HTMLElement, binding: any) {
        if ((el as any)._titleText !== binding.value) {
            (el as any)._titleText = binding.value;
            (el as any)._renderTitle();
        }
    },
    unmounted(el: HTMLElement) {
        if ((el as any)._stopWatchTitle) {
            (el as any)._stopWatchTitle();
        }
    }
};
