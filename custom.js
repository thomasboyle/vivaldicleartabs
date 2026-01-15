/* Vivaldi Mod: Close Unpinned Tabs Button */
(function () {
    const BID = 'vivaldi-close-unpinned-btn',
        TXT = '<div class="btn-content"><span class="btn-text">↓ Clear</span></div>';

    let updateScheduled = false;
    let lastState = { unpinnedCount: 0, pinnedCount: 0, position: null };

    const getY = (e) => {
        let s = e.style, t = s.transform;
        if (t) {
            const i = t.indexOf(',');
            if (i > 0) return parseFloat(t.substring(i + 1));
        }
        let c = window.getComputedStyle(e);
        t = c.transform;
        if (t && t.indexOf('matrix') === 0) {
            return parseFloat(t.split(',').pop().trim().slice(0, -1));
        } else if (t) {
            const i = t.indexOf(',');
            if (i > 0) return parseFloat(t.substring(i + 1));
        }
        return parseFloat(s.top || e.offsetTop || 0);
    };

    const close = () => {
        const s = document.querySelector('.tab-strip');
        if (s) {
            const a = s.querySelectorAll('.tab-position');
            for (let i = 0, l = a.length; i < l; i++) {
                if (!a[i].classList.contains('newtab') && !a[i].getElementsByClassName('pinned').length)
                    a[i].style.display = 'none';
            }
        }
        chrome.tabs.query({ currentWindow: true, pinned: false }, t => {
            if (!t || !t.length) return;
            const ids = new Array(t.length);
            for (let i = 0; i < t.length; i++) ids[i] = t[i].id;
            chrome.tabs.remove(ids);
        });
    };

    const create = () => {
        const b = document.createElement('div');
        b.id = BID; b.title = 'Close all unpinned tabs';
        b.innerHTML = TXT;
        b.onclick = close;
        return b;
    };

    const update = () => {
        updateScheduled = false;
        const strip = document.querySelector('.tab-strip');
        if (!strip) return;

        const all = strip.querySelectorAll('.tab-position');
        const p = [], u = [];

        for (let i = 0, l = all.length; i < l; i++) {
            const el = all[i];
            if (el.classList.contains('newtab')) continue;
            const y = getY(el);
            if (el.getElementsByClassName('pinned').length > 0) p.push({ e: el, y: y });
            else u.push({ e: el, y: y });
        }

        let b = document.getElementById(BID);
        if (!u.length) {
            if (b) {
                if (b.style.display !== 'none') {
                    b.style.display = 'none';
                    lastState.unpinnedCount = 0;
                    lastState.pinnedCount = p.length;
                    lastState.position = null;
                }
            }
            return;
        }

        p.sort((a, b) => a.y - b.y);
        u.sort((a, b) => a.y - b.y);

        let fy = 0;
        if (p.length) {
            const last = p[p.length - 1];
            const pb = last.y + last.e.offsetHeight;
            const ut = u[0].y;
            const gap = ut - pb;
            fy = (gap > 0) ? (pb + gap / 2 - 11) : (pb - 1);
        }

        if (lastState.unpinnedCount === u.length && 
            lastState.pinnedCount === p.length && 
            lastState.position === fy && b) {
            return;
        }

        if (!b) { b = create(); strip.appendChild(b); }

        const s = b.style;
        if (s.display !== 'flex') s.display = 'flex';
        if (!b.classList.contains('vertical')) b.className += ' vertical';
        if (s.transform !== `translate3d(0,${fy}px,0)`) {
            s.transform = `translate3d(0,${fy}px,0)`;
        }
        s.width = '100%';

        lastState.unpinnedCount = u.length;
        lastState.pinnedCount = p.length;
        lastState.position = fy;
    };

    const scheduleUpdate = () => {
        if (!updateScheduled) {
            updateScheduled = true;
            requestAnimationFrame(update);
        }
    };

    const init = () => {
        const browser = document.querySelector('#browser');
        if (!browser) {
            setTimeout(init, 500);
            return;
        }

        const strip = document.querySelector('.tab-strip');
        if (!strip) {
            setTimeout(init, 500);
            return;
        }

        const observer = new MutationObserver(scheduleUpdate);
        observer.observe(strip, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        const stripContainer = strip.parentElement || strip;
        stripContainer.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', scheduleUpdate, { passive: true });

        scheduleUpdate();
    };
    init();
})();
