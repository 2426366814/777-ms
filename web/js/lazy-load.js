
const LazyLoader = {
    init() {
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const el = entry.target;
                        if (el.dataset.src) {
                            el.src = el.dataset.src;
                            el.removeAttribute('data-src');
                            el.classList.remove('lazy');
                            el.classList.add('lazy-loaded');
                        }
                        if (el.dataset.bg) {
                            el.style.backgroundImage = 'url(' + el.dataset.bg + ')';
                            el.removeAttribute('data-bg');
                        }
                        observer.unobserve(el);
                    }
                });
            }, { rootMargin: '50px' });
            
            document.querySelectorAll('.lazy, [data-src], [data-bg]').forEach(el => {
                observer.observe(el);
            });
        } else {
            document.querySelectorAll('[data-src]').forEach(el => {
                el.src = el.dataset.src;
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => LazyLoader.init());
window.LazyLoader = LazyLoader;
