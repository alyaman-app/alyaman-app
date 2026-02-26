const revealItems = document.querySelectorAll('[data-reveal]');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.2 }
);

revealItems.forEach((item) => observer.observe(item));

const buttons = document.querySelectorAll('.btn');
buttons.forEach((btn) => {
  btn.addEventListener('click', () => {
    btn.classList.add('pulse');
    setTimeout(() => btn.classList.remove('pulse'), 320);
  });
});

function initDownloadLinks() {
  const downloadButtons = document.querySelectorAll('[data-download]');
  downloadButtons.forEach((btn) => {
    const type = btn.dataset.download;
    const link = getCurrentLink(type);
    btn.href = link || '#';

    btn.addEventListener('click', (event) => {
      const currentLink = getCurrentLink(type);
      if (!currentLink || currentLink.startsWith('https://example.com')) {
        event.preventDefault();
        alert('الرابط غير محدث بعد من لوحة الادمن.');
        return;
      }
      recordDownload(type);
    });
  });
}

initDownloadLinks();
