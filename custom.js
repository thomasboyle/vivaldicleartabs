(function () {
    const BID = 'vivaldi-close-unpinned-btn',
        TXT = '<div class="btn-content"><span class="btn-text">↓ Clear</span></div>',
        BUTTON_HEIGHT = 20,
        EQUAL_PADDING = 5,
        INIT_DELAY = 500,
        POS_Y = '--PositionY',
        POS_X = '--PositionX',
        WIDTH = '--Width',
        HEIGHT = '--Height',
        ORIG_WIDTH = '--original-width',
        ORIG_POS_X = '--original-position-x',
        COMMA = ',',
        PX = 'px',
        ZERO_STR = '0',
        ZERO_PX = '0px',
        HALF_HEIGHT = 10,
        PADDING_2X = 10,
        MATRIX_M = 109,
        FLEX_STR = 'flex',
        NONE_STR = 'none',
        VERTICAL_STR = ' vertical',
        TABS_RIGHT_STR = 'tabs-right',
        WIDTH_100 = '100%',
        STATIC_STR = 'static',
        RELATIVE_STR = 'relative',
        ZERO_STR_PX = '0';

    let updateScheduled = false;
    let lastState = { unpinnedCount: 0, pinnedCount: 0, position: null };
    let adjustedSeparators = new Set();
    let cachedStrip = null;
    let cachedButton = null;

    const getY = (e, cachedRect = null, stripTop = 0) => {
        const s = e.style;
        let t = s.transform;
        if (t) {
            const i = t.indexOf(COMMA);
            if (i > 0) return parseFloat(t.substring(i + 1));
        }
        const c = window.getComputedStyle(e);
        t = c.transform;
        if (!t) {
            return cachedRect !== null ? cachedRect.top - stripTop : parseFloat(s.top || e.offsetTop || 0);
        }
        if (t.charCodeAt(0) === MATRIX_M) {
            const parts = t.split(COMMA);
            return parseFloat(parts[5].trim().slice(0, -1));
        }
        const i = t.indexOf(COMMA);
        return i > 0 ? parseFloat(t.substring(i + 1)) : (cachedRect !== null ? cachedRect.top - stripTop : parseFloat(s.top || e.offsetTop || 0));
    };

    const close = () => {
        const s = cachedStrip || document.querySelector('.tab-strip');
        if (!s) return;
        const a = s.querySelectorAll('.tab-position');
        const l = a.length;
        const ids = [];
        for (let i = 0; i < l; i++) {
            const el = a[i];
            if (!el.classList.contains('newtab') && !el.getElementsByClassName('pinned').length) {
                el.style.display = NONE_STR;
            }
        }
        chrome.tabs.query({ currentWindow: true, pinned: false }, t => {
            if (!t || !t.length) return;
            const len = t.length;
            for (let i = 0; i < len; i++) {
                ids[i] = t[i].id;
            }
            chrome.tabs.remove(ids);
        });
    };

    const create = () => {
        const b = document.createElement('div');
        b.id = BID;
        b.title = 'Close all unpinned tabs';
        b.innerHTML = TXT;
        b.onclick = close;
        cachedButton = b;
        return b;
    };

    const getStyleProp = (el, prop, def) => {
        return el.style.getPropertyValue(prop) || def;
    };

    let cachedViewportWidth = 0;
    const isTabsOnRight = (strip) => {
        const rect = strip.getBoundingClientRect();
        if (!cachedViewportWidth) cachedViewportWidth = window.innerWidth || document.documentElement.clientWidth;
        return rect.left > cachedViewportWidth * 0.5;
    };

    const sortByY = (arr) => {
        if (arr.length < 2) return;
        arr.sort((a, b) => a.y - b.y);
    };

    const update = () => {
        updateScheduled = false;
        const strip = cachedStrip || document.querySelector('.tab-strip');
        if (!strip) return;
        cachedStrip = strip;

        const all = strip.querySelectorAll('.tab-position');
        const p = [], u = [];
        const l = all.length;
        const rects = new Array(l);
        const stripRect = strip.getBoundingClientRect();
        const stripTop = stripRect.top;

        for (let i = 0; i < l; i++) {
            rects[i] = all[i].getBoundingClientRect();
        }

        for (let i = 0; i < l; i++) {
            const el = all[i];
            if (el.classList.contains('newtab')) continue;
            const y = getY(el, rects[i], stripTop);
            const hasPinned = el.getElementsByClassName('pinned').length > 0;
            if (hasPinned) {
                p[p.length] = { e: el, y: y };
            } else {
                u[u.length] = { e: el, y: y };
            }
        }

        let b = cachedButton || document.getElementById(BID);
        if (!u.length) {
            if (b && b.style.display !== NONE_STR) {
                b.style.display = NONE_STR;
                lastState.unpinnedCount = 0;
                lastState.pinnedCount = p.length;
                lastState.position = null;
                resetSeparators();
            }
            return;
        }

        sortByY(p);
        sortByY(u);

        let fy = 0;
        if (p.length) {
            const last = p[p.length - 1];
            const pb = last.y + last.e.offsetHeight;
            const ut = u[0].y;
            const gap = ut - pb;
            fy = gap > 0 ? pb + (gap * 0.5) - 11 : pb - 1;
        }

        const separators = strip.querySelectorAll('.separator');
        const sepLen = separators.length;
        const fyPlusHalf = fy + HALF_HEIGHT;
        
        for (let i = 0; i < sepLen; i++) {
            const sep = separators[i];
            const sepY = parseFloat(getStyleProp(sep, POS_Y, ZERO_STR));
            const sepHeight = parseFloat(getStyleProp(sep, HEIGHT, ZERO_STR));
            const sepCenter = sepY + (sepHeight * 0.5);
            const diff = Math.abs(fyPlusHalf - sepCenter);
            const threshold = (sepHeight * 0.5) + HALF_HEIGHT;
            
            if (diff < threshold) {
                fy = sepCenter - HALF_HEIGHT;
                break;
            }
        }

        if (lastState.unpinnedCount === u.length && 
            lastState.pinnedCount === p.length && 
            lastState.position === fy && b) {
            return;
        }

        if (!b) {
            b = create();
            strip.appendChild(b);
        }

        const s = b.style;
        if (s.display !== FLEX_STR) s.display = FLEX_STR;
        const hasVertical = b.classList.contains('vertical');
        if (!hasVertical) b.className += VERTICAL_STR;
        const tabsOnRight = isTabsOnRight(strip);
        const hasTabsRight = b.classList.contains(TABS_RIGHT_STR);
        if (tabsOnRight && !hasTabsRight) {
            b.classList.add(TABS_RIGHT_STR);
        } else if (!tabsOnRight && hasTabsRight) {
            b.classList.remove(TABS_RIGHT_STR);
        }
        const buttonY = fy - 1;
        const transformStr = 'translate3d(0,' + buttonY + 'px,0)';
        if (s.transform !== transformStr) {
            s.transform = transformStr;
            b.offsetHeight;
        }
        s.width = WIDTH_100;

        requestAnimationFrame(() => {
            const stripComputed = window.getComputedStyle(strip);
            if (stripComputed.position === STATIC_STR) {
                strip.style.position = RELATIVE_STR;
            }
            
            const buttonContent = b.querySelector('.btn-content');
            const stripRect = strip.getBoundingClientRect();
            const buttonRect = b.getBoundingClientRect();
            const contentRect = buttonContent ? buttonContent.getBoundingClientRect() : null;
            
            if (buttonRect.width === 0 || buttonRect.height === 0) {
                s.width = WIDTH_100;
            }
            
            if (contentRect) {
                const overflow = contentRect.right > stripRect.right || contentRect.left < stripRect.left || 
                    buttonRect.right > stripRect.right || buttonRect.left < stripRect.left;
                if (overflow) {
                    s.width = stripRect.width + PX;
                    s.left = ZERO_STR_PX;
                    s.right = ZERO_STR_PX;
                }
            }
        });

        adjustSeparators(b, buttonY);

        lastState.unpinnedCount = u.length;
        lastState.pinnedCount = p.length;
        lastState.position = fy;
    };

    const resetSeparators = () => {
        const strip = cachedStrip || document.querySelector('.tab-strip');
        if (!strip) return;
        cachedStrip = strip;

        const separators = strip.querySelectorAll('.separator');
        const l = separators.length;
        for (let i = 0; i < l; i++) {
            const sep = separators[i];
            const originalWidth = getStyleProp(sep, ORIG_WIDTH, '');
            if (originalWidth) {
                sep.style.setProperty(WIDTH, originalWidth);
                const originalPositionX = getStyleProp(sep, ORIG_POS_X, '');
                if (originalPositionX) {
                    sep.style.setProperty(POS_X, originalPositionX);
                }
                sep.style.removeProperty(ORIG_WIDTH);
                sep.style.removeProperty(ORIG_POS_X);
            }
        }
        adjustedSeparators.clear();
    };

    const adjustSeparators = (button, buttonY) => {
        const strip = cachedStrip || document.querySelector('.tab-strip');
        if (!strip || !button || button.style.display === NONE_STR) {
            resetSeparators();
            return;
        }
        cachedStrip = strip;

        requestAnimationFrame(() => {
            const separators = strip.querySelectorAll('.separator');
            const buttonContent = button.querySelector('.btn-content');
            if (!buttonContent) return;

            const buttonContentWidth = buttonContent.offsetWidth;
            const stripWidth = strip.offsetWidth;
            const buttonLeft = stripWidth - buttonContentWidth - EQUAL_PADDING;
            const buttonTop = buttonY;
            const buttonBottom = buttonY + button.offsetHeight;

            const currentAdjusted = new Set();
            const sepLen = separators.length;

            for (let i = 0; i < sepLen; i++) {
                const sep = separators[i];
                const sepY = parseFloat(getStyleProp(sep, POS_Y, ZERO_STR));
                const sepHeight = parseFloat(getStyleProp(sep, HEIGHT, ZERO_STR));
                const sepTop = sepY;
                const sepBottom = sepY + sepHeight;

                const overlaps = sepBottom >= buttonTop && sepTop <= buttonBottom;
                if (overlaps) {
                    const originalWidth = getStyleProp(sep, ORIG_WIDTH, '');
                    if (!originalWidth) {
                        const currentWidth = parseFloat(getStyleProp(sep, WIDTH, ZERO_STR));
                        const currentPositionX = getStyleProp(sep, POS_X, ZERO_PX);
                        sep.style.setProperty(ORIG_WIDTH, currentWidth + PX);
                        sep.style.setProperty(ORIG_POS_X, currentPositionX);
                    }
                    const newWidth = Math.max(0, buttonLeft - PADDING_2X);
                    sep.style.setProperty(POS_X, EQUAL_PADDING + PX);
                    sep.style.setProperty(WIDTH, newWidth + PX);
                    currentAdjusted.add(sep);
                } else {
                    const originalWidth = getStyleProp(sep, ORIG_WIDTH, '');
                    if (originalWidth && adjustedSeparators.has(sep)) {
                        sep.style.setProperty(WIDTH, originalWidth);
                        const originalPositionX = getStyleProp(sep, ORIG_POS_X, '');
                        if (originalPositionX) {
                            sep.style.setProperty(POS_X, originalPositionX);
                        }
                        sep.style.removeProperty(ORIG_WIDTH);
                        sep.style.removeProperty(ORIG_POS_X);
                    }
                }
            }

            for (const sep of adjustedSeparators) {
                if (!currentAdjusted.has(sep)) {
                    const originalWidth = getStyleProp(sep, ORIG_WIDTH, '');
                    if (originalWidth) {
                        sep.style.setProperty(WIDTH, originalWidth);
                        const originalPositionX = getStyleProp(sep, ORIG_POS_X, '');
                        if (originalPositionX) {
                            sep.style.setProperty(POS_X, originalPositionX);
                        }
                        sep.style.removeProperty(ORIG_WIDTH);
                        sep.style.removeProperty(ORIG_POS_X);
                    }
                }
            }

            adjustedSeparators = currentAdjusted;
        });
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
            setTimeout(init, INIT_DELAY);
            return;
        }

        const strip = document.querySelector('.tab-strip');
        if (!strip) {
            setTimeout(init, INIT_DELAY);
            return;
        }
        cachedStrip = strip;

        const observer = new MutationObserver(scheduleUpdate);
        observer.observe(strip, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        const stripContainer = strip.parentElement || strip;
        stripContainer.addEventListener('scroll', scheduleUpdate, { passive: true });
        window.addEventListener('resize', () => {
            cachedViewportWidth = 0;
            scheduleUpdate();
        }, { passive: true });

        scheduleUpdate();
    };
    init();
})();
