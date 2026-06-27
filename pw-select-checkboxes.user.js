// ==UserScript==
// @name         Выделить чекбоксы (Perfect World)
// @namespace    https://pwonline.ru/
// @version      4.2
// @description  Выделение предметов, прокрутка к «Передать», снятие лимита в 6 чекбоксов, сервер «Мицар» и персонаж с max уровнем
// @author       Varnakov
// @match        https://pwonline.ru/promo_items.php*
// @updateURL    https://raw.githubusercontent.com/Varnakov/PW_promo_items/main/pw-select-checkboxes.user.js
// @downloadURL  https://raw.githubusercontent.com/Varnakov/PW_promo_items/main/pw-select-checkboxes.user.js
// @inject-into  page
// @grant        GM_addStyle
// @icon         https://pwonline.ru/favicon.ico
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const ITEMS_LIMIT = 6;

    GM_addStyle(`
        .pw-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin: 20px 0;
        }
        .pw-btn {
            padding: 12px 30px;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 15px;
            transition: all 0.3s;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .pw-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
        }
        .pw-btn:active {
            transform: translateY(1px);
        }
        .pw-select-all { background: #4CAF50; }
        .pw-select-all:hover { background: #45a049; }
        .pw-select-six { background: #2196F3; }
        .pw-select-six:hover { background: #1e88e5; }
    `);

    const getJQuery = () => window.jQuery || window.$;

    const injectPageScript = (code) => {
        const script = document.createElement('script');
        script.textContent = code;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
    };

    const initMitsarShard = () => {
        if (document.documentElement.dataset.pwMitsarInjected) return;
        document.documentElement.dataset.pwMitsarInjected = '1';

        injectPageScript(`
(function() {
    if (window.__pwMitsarReady) return;
    window.__pwMitsarReady = true;
    window.__pwShardLocked = false;
    window.__pwCharLocked = false;

    var SHARD_NAME = '\\u041c\\u0438\\u0446\\u0430\\u0440';
    var LEVEL_RE = /\\u0443\\u0440\\u043e\\u0432\\u0435\\u043d\\u044c\\s*:\\s*(\\d+)/i;

    function findMitsarId() {
        if (typeof shards === 'undefined' || !shards) return null;
        for (var key in shards) {
            if (!Object.prototype.hasOwnProperty.call(shards, key)) continue;
            if (String(shards[key].name).trim() === SHARD_NAME) {
                return String(shards[key].id);
            }
        }
        return null;
    }

    function charsMatchShard(mitsarId) {
        var opts = document.querySelectorAll('.js-char option');
        if (!opts.length) return true;
        for (var i = 0; i < opts.length; i++) {
            if (String(opts[i].value).split('_')[1] === mitsarId) return true;
        }
        return false;
    }

    function selectedShardName() {
        var el = document.querySelector('.js-shard');
        if (!el || el.selectedIndex < 0) return '';
        return el.options[el.selectedIndex].text.trim();
    }

    function parseCharLevel(text) {
        var match = String(text).match(LEVEL_RE);
        return match ? parseInt(match[1], 10) : -1;
    }

    function getBestCharOption(opts) {
        var bestOption = null;
        var bestLevel = -1;
        var bestText = '';

        for (var i = 0; i < opts.length; i++) {
            var level = parseCharLevel(opts[i].text);
            var text = String(opts[i].text).trim();

            if (level > bestLevel) {
                bestLevel = level;
                bestOption = opts[i];
                bestText = text;
            } else if (level === bestLevel && bestOption && text.localeCompare(bestText, 'ru') < 0) {
                bestOption = opts[i];
                bestText = text;
            }
        }

        return bestOption;
    }

    function isHighestCharSelected() {
        var select = document.querySelector('.js-char');
        if (!select || select.selectedIndex < 0) return false;

        var opts = select.querySelectorAll('option');
        if (!opts.length) return false;

        var bestOption = getBestCharOption(opts);
        return bestOption && select.value === bestOption.value;
    }

    function selectHighestLevelChar() {
        if (window.__pwCharLocked) return;

        var select = document.querySelector('.js-char');
        if (!select) return;

        var opts = select.querySelectorAll('option');
        if (!opts.length) return;

        var bestOption = getBestCharOption(opts);
        if (!bestOption || parseCharLevel(bestOption.text) < 0) return;
        if (select.value === bestOption.value) return;

        select.value = bestOption.value;
        for (var j = 0; j < opts.length; j++) {
            opts[j].selected = opts[j] === bestOption;
        }
    }

    function hookCharInint() {
        if (window.__pwCharInintHooked || typeof charInint !== 'function') return;
        window.__pwCharInintHooked = true;

        var originalCharInint = charInint;
        window.charInint = function(shardID) {
            originalCharInint(shardID);
            selectHighestLevelChar();
        };
    }

    function applyMitsar() {
        if (window.__pwShardLocked) return;
        if (typeof jQuery === 'undefined' || typeof charInint !== 'function' || typeof shards === 'undefined') return;

        var mitsarId = findMitsarId();
        if (!mitsarId) return;

        var $shard = jQuery('.js-shard');
        if (!$shard.length) return;

        if (selectedShardName() === SHARD_NAME && charsMatchShard(mitsarId)) {
            selectHighestLevelChar();
            return;
        }

        $shard.empty();
        jQuery.each(shards, function() {
            var selected = String(this.id) === mitsarId ? ' selected="selected"' : '';
            $shard.append('<option value="' + this.id + '"' + selected + '>' + this.name + '</option>');
        });

        charInint(mitsarId);
        selectHighestLevelChar();
    }

    function bindShardLock() {
        var el = document.querySelector('.js-shard');
        if (!el || el.dataset.pwShardLock) return;
        el.dataset.pwShardLock = '1';
        el.addEventListener('change', function() {
            window.__pwCharLocked = false;
            if (selectedShardName() !== SHARD_NAME) {
                window.__pwShardLocked = true;
            }
        });
    }

    function bindCharLock() {
        var el = document.querySelector('.js-char');
        if (!el || el.dataset.pwCharLock) return;
        el.dataset.pwCharLock = '1';
        el.addEventListener('change', function() {
            if (!isHighestCharSelected()) {
                window.__pwCharLocked = true;
            }
        });
    }

    function tick() {
        hookCharInint();
        bindShardLock();
        bindCharLock();
        applyMitsar();
        selectHighestLevelChar();
    }

    function startShardWatcher() {
        tick();
        setInterval(tick, 500);
        [0, 100, 300, 600, 1000, 2000, 4000, 6000].forEach(function(delay) {
            setTimeout(tick, delay);
        });
    }

    if (typeof jQuery !== 'undefined') {
        jQuery(startShardWatcher);
    } else {
        document.addEventListener('DOMContentLoaded', startShardWatcher);
    }
})();
        `);
    };

    const disableCheckboxLimit = () => {
        document.querySelectorAll('.items_container input[type="checkbox"]').forEach((el) => {
            el.removeAttribute('disabled');
        });

        const $ = getJQuery();
        if (!$) return;

        $('.items_container input[type=checkbox]').off('click');
        $('.item_input_block').off('mouseover');
    };

    const findTargetElement = () => {
        const textNodes = document.evaluate(
            "//text()[contains(., 'Среднее время передачи подарка в игру составляет 30 минут.')]",
            document,
            null,
            XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
            null
        );

        for (let i = 0; i < textNodes.snapshotLength; i++) {
            const node = textNodes.snapshotItem(i);
            if (node.textContent.trim() === 'Среднее время передачи подарка в игру составляет 30 минут.') {
                return node.parentElement;
            }
        }
        return null;
    };

    const getItemCheckboxes = () =>
        Array.from(document.querySelectorAll('.items_container input[type="checkbox"]'));

    const setCheckboxChecked = (checkbox, checked) => {
        checkbox.checked = checked;
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const pulseButton = (button) => {
        button.style.transform = 'scale(0.98)';
        setTimeout(() => { button.style.transform = ''; }, 100);
    };

    const scrollToTransferButton = () => {
        const transferButton = document.querySelector('.js-transfer-go');
        if (transferButton) {
            setTimeout(() => {
                transferButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 150);
        }
    };

    const selectAllItems = () => {
        getItemCheckboxes().forEach((checkbox) => {
            setCheckboxChecked(checkbox, true);
        });
        scrollToTransferButton();
    };

    const selectFirstSixAndScroll = () => {
        getItemCheckboxes().forEach((checkbox, index) => {
            setCheckboxChecked(checkbox, index < ITEMS_LIMIT);
        });
        scrollToTransferButton();
    };

    const createButton = (className, label, onClick) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pw-btn ' + className;
        button.innerHTML = label;
        button.addEventListener('click', () => {
            onClick();
            pulseButton(button);
        });
        return button;
    };

    const initButtons = () => {
        if (document.querySelector('.pw-buttons')) return;

        const targetElement = findTargetElement();
        if (!targetElement) return;

        const container = document.createElement('div');
        container.className = 'pw-buttons';

        container.appendChild(createButton(
            'pw-select-all',
            '✅ Выделить все предметы → Передать',
            selectAllItems
        ));

        container.appendChild(createButton(
            'pw-select-six',
            '📦 Выделить 6 предметов → Передать',
            selectFirstSixAndScroll
        ));

        targetElement.insertAdjacentElement('afterend', container);
    };

    const init = () => {
        disableCheckboxLimit();
        initButtons();
        initMitsarShard();
    };

    const start = () => {
        init();
        setInterval(disableCheckboxLimit, 500);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }

    const observer = new MutationObserver(init);
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
})();
