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
        ZERO_STR_PX = '0',
        TRANSLATE3D_PREFIX = 'translate3d(0,',
        TRANSLATE3D_SUFFIX = 'px,0)';

    let updateScheduled = false;
    let lastState = { unpinnedCount: 0, pinnedCount: 0, position: null, stripRect: null, wasVisible: true };
    let adjustedSeparators = new Set();
    let cachedStrip = null;
    let cachedButton = null;
    let mutationObserver = null;
    let resizeObserver = null;
    let intersectionObserver = null;
    let stripObserver = null;
    let fastInitMode = false;
    let verifyInterval = null;
    let scrollHandler = null;
    let resizeHandler = null;
    let fullscreenHandlersAttached = false;
    let cachedComputedStyles = new WeakMap();
    let cachedViewportWidth = 0;
    const win = window;
    const doc = document;

    const getY = (e, cachedRect = null, stripTop = 0) => {
        const s = e.style;
        let t = s.transform;
        if (t) {
            const i = t.indexOf(COMMA);
            if (i > 0) return +t.substring(i + 1);
        }
        let c = cachedComputedStyles.get(e);
        if (!c) {
            c = win.getComputedStyle(e);
            cachedComputedStyles.set(e, c);
        }
        t = c.transform;
        if (!t) {
            return cachedRect !== null ? cachedRect.top - stripTop : +(s.top || e.offsetTop || 0);
        }
        if (t.charCodeAt(0) === MATRIX_M) {
            const parts = t.split(COMMA);
            return +parts[5].trim().slice(0, -1);
        }
        const i = t.indexOf(COMMA);
        return i > 0 ? +t.substring(i + 1) : (cachedRect !== null ? cachedRect.top - stripTop : +(s.top || e.offsetTop || 0));
    };

    const close = () => {
        const s = cachedStrip || doc.querySelector('.tab-strip');
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
            if (!t || !t.length) {
                scheduleUpdate();
                return;
            }
            const len = t.length;
            for (let i = 0; i < len; i++) {
                ids[i] = t[i].id;
            }
            chrome.tabs.remove(ids, () => {
                setTimeout(() => {
                    cachedButton = null;
                    lastState.unpinnedCount = 0;
                    lastState.pinnedCount = 0;
                    lastState.position = null;
                    scheduleUpdate();
                }, 50);
            });
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

    const isTabsOnRight = (strip) => {
        const rect = strip.getBoundingClientRect();
        if (!cachedViewportWidth) {
            cachedViewportWidth = win.innerWidth || doc.documentElement.clientWidth;
        }
        return rect.left > cachedViewportWidth * 0.5;
    };

    const sortByY = (arr) => {
        if (arr.length < 2) return;
        arr.sort((a, b) => a.y - b.y);
    };

    const update = () => {
        updateScheduled = false;

        if (cachedStrip && !doc.body.contains(cachedStrip)) {
            cachedStrip = null;
        }

        let strip = cachedStrip || doc.querySelector('.tab-strip');
        if (!strip) {
            const b = cachedButton || doc.getElementById(BID);
            if (b) {
                b.style.display = NONE_STR;
            }
            return;
        }
        cachedStrip = strip;

        let stripComputed = cachedComputedStyles.get(strip);
        if (!stripComputed) {
            stripComputed = win.getComputedStyle(strip);
            cachedComputedStyles.set(strip, stripComputed);
        }
        const stripRect = strip.getBoundingClientRect();
        const stripDisplay = stripComputed.display;
        const stripVisibility = stripComputed.visibility;
        const isStripVisible = stripDisplay !== NONE_STR && 
                               stripVisibility !== 'hidden' && 
                               stripRect.width > 0 && 
                               stripRect.height > 0;
        
        const visibilityChanged = lastState.wasVisible !== isStripVisible;
        lastState.wasVisible = isStripVisible;
        
        let b = cachedButton || doc.getElementById(BID);
        if (!isStripVisible) {
            if (b) {
                const bStyle = b.style;
                if (bStyle.display !== NONE_STR) {
                    bStyle.display = NONE_STR;
                }
                const parent = b.parentElement;
                if (parent && parent !== strip) {
                    b.remove();
                    cachedButton = null;
                }
            }
            if (visibilityChanged) {
                cachedButton = null;
                lastState.stripRect = null;
            }
            return;
        }
        
        if (visibilityChanged && !b) {
            cachedButton = null;
            lastState.stripRect = null;
            lastState.unpinnedCount = 0;
            lastState.pinnedCount = 0;
            lastState.position = null;
        }

        const all = strip.querySelectorAll('.tab-position');
        const p = [], u = [];
        const l = all.length;
        const rects = new Array(l);
        const stripTop = stripRect.top;

        for (let i = 0; i < l; i++) {
            rects[i] = all[i].getBoundingClientRect();
        }

        for (let i = 0; i < l; i++) {
            const el = all[i];
            if (el.classList.contains('newtab')) continue;
            let elStyle = cachedComputedStyles.get(el);
            if (!elStyle) {
                elStyle = win.getComputedStyle(el);
                cachedComputedStyles.set(el, elStyle);
            }
            if (elStyle.display === NONE_STR) continue;
            const y = getY(el, rects[i], stripTop);
            const hasPinned = el.getElementsByClassName('pinned').length > 0;
            if (hasPinned) {
                p.push({ e: el, y: y });
            } else {
                u.push({ e: el, y: y });
            }
        }

        if (!u.length) {
            if (b) {
                const parent = b.parentElement;
                if (parent && parent !== strip) {
                    b.remove();
                    cachedButton = null;
                } else if (parent === strip) {
                    b.style.display = NONE_STR;
                } else {
                    cachedButton = null;
                }
            }
            lastState.unpinnedCount = 0;
            lastState.pinnedCount = p.length;
            lastState.position = null;
            lastState.stripRect = null;
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
            const sepY = +getStyleProp(sep, POS_Y, ZERO_STR);
            const sepHeight = +getStyleProp(sep, HEIGHT, ZERO_STR);
            const sepCenter = sepY + (sepHeight * 0.5);
            const diff = Math.abs(fyPlusHalf - sepCenter);
            const threshold = (sepHeight * 0.5) + HALF_HEIGHT;
            
            if (diff < threshold) {
                fy = sepCenter - HALF_HEIGHT;
                break;
            }
        }

        const stripRectCurrent = strip.getBoundingClientRect();
        const sr = lastState.stripRect;
        const stripMoved = sr && (
            sr.left !== stripRectCurrent.left ||
            sr.top !== stripRectCurrent.top ||
            sr.width !== stripRectCurrent.width ||
            sr.height !== stripRectCurrent.height
        );

        const bParent = b && b.parentElement;
        const buttonExists = b && bParent === strip && b.style.display !== NONE_STR;
        const shouldSkip = lastState.unpinnedCount === u.length && 
            lastState.pinnedCount === p.length && 
            lastState.position === fy && buttonExists && !stripMoved && !visibilityChanged;
        
        if (shouldSkip && u.length > 0) {
            return;
        }
        
        if (shouldSkip && u.length === 0 && b && b.style.display === NONE_STR) {
            return;
        }

        const wasNewButton = !b || !bParent || bParent !== strip;
        if (wasNewButton) {
            if (b && bParent && bParent !== strip) {
                b.remove();
            }
            b = create();
            strip.appendChild(b);
            cachedButton = b;
        }

        const s = b.style;
        if (s.display !== FLEX_STR) s.display = FLEX_STR;
        const bClassList = b.classList;
        if (!bClassList.contains('vertical')) b.className += VERTICAL_STR;
        const tabsOnRight = isTabsOnRight(strip);
        const hasTabsRight = bClassList.contains(TABS_RIGHT_STR);
        if (tabsOnRight) {
            if (!hasTabsRight) bClassList.add(TABS_RIGHT_STR);
        } else if (hasTabsRight) {
            bClassList.remove(TABS_RIGHT_STR);
        }
        const buttonY = fy - 1;
        s.transform = TRANSLATE3D_PREFIX + buttonY + TRANSLATE3D_SUFFIX;
        s.width = WIDTH_100;
        s.left = '';
        s.right = '';

        if (stripComputed.position === STATIC_STR) {
            strip.style.position = RELATIVE_STR;
        }

        if (wasNewButton) {
            b.offsetHeight;
        }

        adjustSeparators(b, buttonY, true);

        requestAnimationFrame(() => {
            const buttonContent = b.querySelector('.btn-content');
            const currentStripRect = strip.getBoundingClientRect();
            const buttonRect = b.getBoundingClientRect();
            const contentRect = buttonContent ? buttonContent.getBoundingClientRect() : null;
            
            if (buttonRect.width === 0 || buttonRect.height === 0) {
                s.width = WIDTH_100;
            }
            
            if (contentRect) {
                const cr = contentRect, csr = currentStripRect, br = buttonRect;
                const overflow = cr.right > csr.right || cr.left < csr.left || 
                    br.right > csr.right || br.left < csr.left;
                if (overflow) {
                    s.width = csr.width + PX;
                    s.left = ZERO_STR_PX;
                    s.right = ZERO_STR_PX;
                }
            }
            
            adjustSeparators(b, buttonY, false);
        });

        lastState.unpinnedCount = u.length;
        lastState.pinnedCount = p.length;
        lastState.position = fy;
        lastState.stripRect = {
            left: stripRect.left,
            top: stripRect.top,
            width: stripRect.width,
            height: stripRect.height
        };
    };

    const resetSeparators = () => {
        if (cachedStrip && !doc.body.contains(cachedStrip)) {
            cachedStrip = null;
        }
        const strip = cachedStrip || doc.querySelector('.tab-strip');
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
            const hr = sep.querySelector('hr');
            if (hr) {
                hr.style.maxWidth = '';
                hr.style.visibility = 'hidden';
            }
        }
        adjustedSeparators.clear();
    };

    const adjustSeparators = (button, buttonY, synchronous) => {
        if (cachedStrip && !doc.body.contains(cachedStrip)) {
            cachedStrip = null;
        }
        const strip = cachedStrip || doc.querySelector('.tab-strip');
        if (!strip || !button || button.style.display === NONE_STR) {
            resetSeparators();
            return;
        }
        cachedStrip = strip;

        const doAdjust = () => {
            const separators = strip.querySelectorAll('.separator');
            const buttonContent = button.querySelector('.btn-content');
            if (!buttonContent) return;

            if (synchronous) {
                buttonContent.offsetWidth;
            }
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
                    const newWidthStr = newWidth + PX;
                    sep.style.setProperty(POS_X, EQUAL_PADDING + PX);
                    sep.style.setProperty(WIDTH, newWidthStr);
                    
                    const hr = sep.querySelector('hr');
                    if (hr) {
                        hr.style.maxWidth = newWidthStr;
                        hr.style.visibility = 'visible';
                    }
                    
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
                        
                        const hr = sep.querySelector('hr');
                        if (hr) {
                            hr.style.maxWidth = '';
                            hr.style.visibility = 'hidden';
                        }
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
                        
                        const hr = sep.querySelector('hr');
                        if (hr) {
                            hr.style.maxWidth = '';
                        }
                    }
                }
            }

            adjustedSeparators = currentAdjusted;
        };

        if (synchronous) {
            doAdjust();
        } else {
            requestAnimationFrame(doAdjust);
        }
    };

    const scheduleUpdate = () => {
        if (!updateScheduled) {
            updateScheduled = true;
            requestAnimationFrame(update);
        }
    };

    const cleanup = () => {
        if (mutationObserver) {
            mutationObserver.disconnect();
            mutationObserver = null;
        }
        if (resizeObserver) {
            resizeObserver.disconnect();
            resizeObserver = null;
        }
        if (intersectionObserver) {
            intersectionObserver.disconnect();
            intersectionObserver = null;
        }
        if (stripObserver) {
            stripObserver.disconnect();
            stripObserver = null;
        }
        if (verifyInterval !== null) {
            clearInterval(verifyInterval);
            verifyInterval = null;
        }
        if (scrollHandler) {
            const strip = cachedStrip || doc.querySelector('.tab-strip');
            if (strip) {
                const stripContainer = strip.parentElement || strip;
                stripContainer.removeEventListener('scroll', scrollHandler);
            }
            scrollHandler = null;
        }
        if (resizeHandler) {
            win.removeEventListener('resize', resizeHandler);
            resizeHandler = null;
        }
    };

    const init = () => {
        const browser = doc.querySelector('#browser');
        if (!browser) {
            const delay = fastInitMode ? 50 : INIT_DELAY;
            setTimeout(init, delay);
            return;
        }

        const strip = doc.querySelector('.tab-strip');
        if (!strip) {
            const delay = fastInitMode ? 50 : INIT_DELAY;
            setTimeout(init, delay);
            return;
        }

        cleanup();
        
        // Watch the browser container for the tab-strip being removed/recreated (e.g. around fullscreen video).
        if (!stripObserver) {
            stripObserver = new MutationObserver((mutations) => {
                let stripChanged = false;
                const len = mutations.length;
                for (let i = 0; i < len; i++) {
                    const mutation = mutations[i];
                    if (mutation.type === 'childList') {
                        const addedNodes = mutation.addedNodes;
                        const removedNodes = mutation.removedNodes;
                        const addedLen = addedNodes.length;
                        const removedLen = removedNodes.length;
                        for (let j = 0; j < addedLen; j++) {
                            const node = addedNodes[j];
                            if (node.nodeType === 1 && node.classList && (node.classList.contains('tab-strip') || (node.querySelector && node.querySelector('.tab-strip')))) {
                                stripChanged = true;
                                break;
                            }
                        }
                        if (!stripChanged) {
                            for (let j = 0; j < removedLen; j++) {
                                const node = removedNodes[j];
                                if (node.nodeType === 1 && node.classList && (node.classList.contains('tab-strip') || (node.querySelector && node.querySelector('.tab-strip')))) {
                                    stripChanged = true;
                                    break;
                                }
                            }
                        }
                        if (stripChanged) break;
                    }
                }
                if (stripChanged) {
                    fastInitMode = true;
                    cachedStrip = null;
                    setTimeout(init, 0);
                }
            });
            stripObserver.observe(browser, {
                childList: true,
                subtree: true
            });
        }

        cachedStrip = strip;
        fastInitMode = false;

        const stripContainer = strip.parentElement || strip;

        mutationObserver = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            const len = mutations.length;
            for (let i = 0; i < len; i++) {
                const mutation = mutations[i];
                if (mutation.type === 'childList') {
                    const removedNodes = mutation.removedNodes;
                    const removedLen = removedNodes.length;
                    for (let j = 0; j < removedLen; j++) {
                        const node = removedNodes[j];
                        if (node.id === BID || (node.contains && node.contains(cachedButton))) {
                            cachedButton = null;
                            shouldUpdate = true;
                            break;
                        }
                    }
                    if (!shouldUpdate) {
                        const addedNodes = mutation.addedNodes;
                        const addedLen = addedNodes.length;
                        for (let j = 0; j < addedLen; j++) {
                            const node = addedNodes[j];
                            if (node.nodeType === 1 && node.classList && (node.classList.contains('tab-position') || (node.querySelector && node.querySelector('.tab-position')))) {
                                shouldUpdate = true;
                                break;
                            }
                        }
                    }
                }
                if (!shouldUpdate && (mutation.target === strip || (mutation.target.closest && mutation.target.closest('.tab-strip') === strip))) {
                    shouldUpdate = true;
                }
            }
            if (shouldUpdate) {
                scheduleUpdate();
            }
        });
        mutationObserver.observe(strip, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });
        
        if (strip.parentElement && strip.parentElement !== strip) {
            mutationObserver.observe(strip.parentElement, {
                childList: true,
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        }

        if (win.ResizeObserver) {
            resizeObserver = new ResizeObserver((entries) => {
                cachedViewportWidth = 0;
                const len = entries.length;
                for (let i = 0; i < len; i++) {
                    const entry = entries[i];
                    if (entry.target === strip || entry.target.contains(strip)) {
                        scheduleUpdate();
                        break;
                    }
                }
            });
            resizeObserver.observe(strip);
            
            if (strip.parentElement && strip.parentElement !== strip) {
                resizeObserver.observe(strip.parentElement);
            }
            
            const browserContainer = doc.querySelector('#browser');
            if (browserContainer) {
                resizeObserver.observe(browserContainer);
            }
        }

        if (win.IntersectionObserver) {
            intersectionObserver = new IntersectionObserver((entries) => {
                const len = entries.length;
                for (let i = 0; i < len; i++) {
                    const entry = entries[i];
                    if (!entry.isIntersecting) {
                        const b = cachedButton || doc.getElementById(BID);
                        if (b && b.style.display !== NONE_STR) {
                            b.style.display = NONE_STR;
                        }
                        lastState.wasVisible = false;
                    } else {
                        lastState.wasVisible = true;
                        cachedButton = null;
                        scheduleUpdate();
                    }
                }
            }, {
                root: null,
                threshold: 0
            });
            intersectionObserver.observe(strip);
        }

        scrollHandler = scheduleUpdate;
        stripContainer.addEventListener('scroll', scrollHandler, { passive: true });
        
        resizeHandler = () => {
            cachedViewportWidth = 0;
            scheduleUpdate();
        };
        win.addEventListener('resize', resizeHandler, { passive: true });

        if (!fullscreenHandlersAttached) {
            const handleFullscreenChange = () => {
                // After a fullscreen transition Vivaldi often rebuilds the tab-strip DOM.
                // Clear caches and re-run init shortly so observers attach to the new strip
                // and the clear button can appear without waiting for the periodic verifier.
                cleanup();
                cachedStrip = null;
                cachedButton = null;
                cachedViewportWidth = 0;
                lastState.stripRect = null;
                lastState.unpinnedCount = 0;
                lastState.pinnedCount = 0;
                lastState.position = null;
                lastState.wasVisible = false;
                fastInitMode = true;
                setTimeout(init, 50);
            };
            
            document.addEventListener('fullscreenchange', handleFullscreenChange, { passive: true });
            document.addEventListener('webkitfullscreenchange', handleFullscreenChange, { passive: true });
            document.addEventListener('mozfullscreenchange', handleFullscreenChange, { passive: true });
            document.addEventListener('MSFullscreenChange', handleFullscreenChange, { passive: true });
            fullscreenHandlersAttached = true;
        }

        const verifyButton = () => {
            const strip = cachedStrip || doc.querySelector('.tab-strip');
            if (!strip) return;
            
            let stripComputed = cachedComputedStyles.get(strip);
            if (!stripComputed) {
                stripComputed = win.getComputedStyle(strip);
                cachedComputedStyles.set(strip, stripComputed);
            }
            const stripRect = strip.getBoundingClientRect();
            const isStripVisible = stripComputed.display !== NONE_STR && 
                                   stripComputed.visibility !== 'hidden' && 
                                   stripRect.width > 0 && 
                                   stripRect.height > 0;
            
            if (!isStripVisible) return;
            
            const b = doc.getElementById(BID);
            const allTabs = strip.querySelectorAll('.tab-position:not(.newtab)');
            const pinnedTabs = strip.querySelectorAll('.tab-position:not(.newtab) .pinned');
            const hasUnpinnedTabs = allTabs.length > pinnedTabs.length;
            
            if (hasUnpinnedTabs) {
                const bParent = b && b.parentElement;
                if (!b || !bParent || bParent !== strip) {
                    cachedButton = null;
                    scheduleUpdate();
                } else if (b.style.display === NONE_STR) {
                    scheduleUpdate();
                }
            }
        };

        verifyInterval = setInterval(verifyButton, 1000);

        lastState.unpinnedCount = 0;
        lastState.pinnedCount = 0;
        lastState.position = null;
        scheduleUpdate();
    };
    init();
})();
