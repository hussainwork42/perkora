import { useEffect } from 'react';

/**
 * Progressive enhancement for long forms: elements with
 * data-show-when="field:value1|value2" are shown only while the named
 * select/radio has one of those values. Without JavaScript every field stays
 * visible, so the form always works.
 */
export default function ShowWhen() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-show-when]'));
    const update = () => {
      for (const el of els) {
        const [field, values] = (el.dataset.showWhen ?? '').split(':');
        const form = el.closest('form') ?? document;
        const inputs = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement>(`[name="${field}"]`));
        let value = '';
        for (const i of inputs) {
          if (i instanceof HTMLInputElement && (i.type === 'radio' || i.type === 'checkbox')) {
            if (i.checked) value = i.value;
          } else value = i.value;
        }
        const show = values.split('|').includes(value);
        el.hidden = !show;
      }
    };
    update();
    document.addEventListener('change', update);
    return () => document.removeEventListener('change', update);
  }, []);
  return null;
}
