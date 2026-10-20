// jsdom doesn't implement matchMedia; the app only uses it to detect mobile
window.matchMedia = window.matchMedia || (() => ({ matches: false }));
window.confirm = () => true;
