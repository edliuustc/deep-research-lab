// ==UserScript==
// @name         深研Lab 雪球发布器
// @namespace    https://github.com/edliuustc/deep-research-lab
// @version      2.0
// @description  一键将深研Lab文章（带格式）发布到雪球长文编辑器
// @author       深研Lab
// @match        *://xueqiu.com/*
// @match        *://mp.xueqiu.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @connect      api.github.com
// @connect      edliuustc.github.io
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    // ============ 样式 ============
    GM_addStyle(`
        #shenyan-panel{position:fixed;top:60px;right:20px;width:380px;max-height:80vh;background:#fff;border:2px solid #b71c1c;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.2);z-index:99999;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;display:none}
        #shenyan-panel .sh{background:#b71c1c;color:#fff;padding:12px 16px;font-size:16px;font-weight:700;display:flex;justify-content:space-between;align-items:center;border-radius:10px 10px 0 0}
        #shenyan-panel .sc{cursor:pointer;font-size:22px;opacity:.8}
        #shenyan-panel .sc:hover{opacity:1}
        #shenyan-panel .sb{padding:16px;overflow-y:auto;max-height:60vh}
        #shenyan-panel .btn{display:block;width:100%;padding:10px;margin:8px 0;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer}
        #shenyan-panel .bp{background:#b71c1c;color:#fff}
        #shenyan-panel .bp:hover{background:#d32f2f}
        #shenyan-panel .bs{background:#f5f5f5;color:#333;border:1px solid #ddd}
        #shenyan-panel .ai{padding:10px 12px;margin:6px 0;background:#f9f9f9;border-radius:8px;cursor:pointer;border-left:3px solid #b71c1c}
        #shenyan-panel .ai:hover{background:#fff3f3}
        #shenyan-panel .at{font-weight:600;font-size:14px}
        #shenyan-panel .am{font-size:12px;color:#999;margin-top:4px}
        #shenyan-panel .st{padding:10px;margin:8px 0;border-radius:8px;font-size:13px}
        #shenyan-panel .si{background:#e3f2fd;color:#1565c0}
        #shenyan-panel .so{background:#e8f5e9;color:#1b5e20}
        #shenyan-panel .se{background:#fce4ec;color:#b71c1c}
        #shenyan-panel .ui{width:100%;padding:8px 12px;border:1px solid #ddd;border-radius:6px;font-size:13px;box-sizing:border-box;margin:8px 0}
        #shenyan-fab{position:fixed;bottom:30px;right:30px;width:56px;height:56px;background:#b71c1c;color:#fff;border:none;border-radius:50%;font-size:24px;cursor:pointer;box-shadow:0 4px 16px rgba(183,28,28,.4);z-index:99998;display:flex;align-items:center;justify-content:center;transition:all .3s}
        #shenyan-fab:hover{transform:scale(1.1);box-shadow:0 6px 20px rgba(183,28,28,.6)}
    `);

    // ============ 工具函数 ============

    function cleanHtml(html) {
        var p = new DOMParser();
        var doc = p.parseFromString(html, 'text/html');
        ['head','script','style','meta','link','nav'].forEach(function(t) {
            doc.querySelectorAll(t).forEach(function(e) { e.remove(); });
        });
        doc.querySelectorAll('[class*="qrcode"],[class*="footer"],[class*="subscribe"],[class*="qr-"]').forEach(function(e) { e.remove(); });
        var c = doc.body ? doc.body.innerHTML : html;
        c = c.replace(/background\s*:\s*linear-gradient[^;]+;?/gi, '');
        c = c.replace(/display\s*:\s*flex[^;]*;?/gi, '');
        c = c.replace(/display\s*:\s*grid[^;]*;?/gi, '');
        c = c.replace(/position\s*:\s*(absolute|fixed)[^;]*;?/gi, '');
        return c;
    }

    function extractTitle(html) {
        var m = html.match(/<h1[^>]*>(.*?)<\/h1>/i) || html.match(/<title>(.*?)<\/title>/i);
        return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
    }

    // 填写标题 - 遍历所有可能的标题输入框
    function fillTitle(title) {
        if (!title) return;

        // 方法1: 找所有 input 和 textarea，检查 placeholder
        var allInputs = document.querySelectorAll('input, textarea');
        for (var i = 0; i < allInputs.length; i++) {
            var el = allInputs[i];
            var ph = (el.placeholder || '').toLowerCase();
            var nm = (el.name || '').toLowerCase();
            if (ph.indexOf('标题') >= 0 || ph.indexOf('title') >= 0 || nm === 'title') {
                setNativeValue(el, title);
                console.log('[深研Lab] 标题已填写(input):', title);
                return true;
            }
        }

        // 方法2: 找 contenteditable 的标题区域（有些编辑器标题也是 contenteditable）
        var titleEls = document.querySelectorAll('[class*="title"][contenteditable], [data-placeholder*="标题"]');
        for (var j = 0; j < titleEls.length; j++) {
            titleEls[j].textContent = title;
            titleEls[j].dispatchEvent(new Event('input', {bubbles: true}));
            console.log('[深研Lab] 标题已填写(contenteditable):', title);
            return true;
        }

        // 方法3: 按 DOM 位置找 —— 编辑器上方的第一个大输入框
        var candidates = document.querySelectorAll('input[type="text"], textarea');
        for (var k = 0; k < candidates.length; k++) {
            var rect = candidates[k].getBoundingClientRect();
            // 标题框通常在页面上部，宽度较大
            if (rect.top < 300 && rect.width > 300) {
                setNativeValue(candidates[k], title);
                console.log('[深研Lab] 标题已填写(位置推断):', title);
                return true;
            }
        }

        console.log('[深研Lab] 未找到标题输入框');
        return false;
    }

    // 设置 input 值，兼容 React/Vue 框架
    function setNativeValue(el, value) {
        // 直接设值
        el.value = value;
        // 触发事件让框架感知
        el.dispatchEvent(new Event('input', {bubbles: true}));
        el.dispatchEvent(new Event('change', {bubbles: true}));
        el.dispatchEvent(new Event('blur', {bubbles: true}));
        // 备用：模拟键盘输入
        if (el.value !== value) {
            el.focus();
            el.select();
            document.execCommand('insertText', false, value);
        }
    }

    // 注入文章到编辑器
    function injectToEditor(html, title) {
        // 查找编辑器
        var editors = [
            document.querySelector('.ql-editor'),
            document.querySelector('[contenteditable="true"]'),
            document.querySelector('.ProseMirror'),
            document.querySelector('.w-e-text'),
            document.querySelector('[role="textbox"]'),
        ].filter(Boolean);

        // 排除标题区域的 contenteditable（通常较矮）
        editors = editors.filter(function(e) { return e.offsetHeight > 100; });

        // iframe 内编辑器
        document.querySelectorAll('iframe').forEach(function(f) {
            try {
                var d = f.contentDocument;
                var e = d.querySelector('.ql-editor') || d.querySelector('[contenteditable="true"]');
                if (e && e.offsetHeight > 100) editors.push(e);
            } catch(err) {}
        });

        if (!editors.length) {
            // 最后兜底
            editors = Array.from(document.querySelectorAll('[contenteditable]')).filter(function(e) {
                return e.offsetHeight > 100;
            });
        }

        if (!editors.length) return {ok: false, msg: '未找到编辑器！请确认已打开雪球"写文章"页面。'};

        var editor = editors[0];
        console.log('[深研Lab] 找到编辑器:', editor.tagName, editor.className, 'h:', editor.offsetHeight);

        // 方法1: 写入剪贴板（最稳定）
        try {
            var blob = new Blob([html], {type: 'text/html'});
            var plainBlob = new Blob([html.replace(/<[^>]+>/g, '')], {type: 'text/plain'});
            var item = new ClipboardItem({'text/html': blob, 'text/plain': plainBlob});
            navigator.clipboard.write([item]).then(function() {
                console.log('[深研Lab] 已写入剪贴板');
                // 自动聚焦编辑器
                editor.focus();
                showStatus('📋 文章已复制到剪贴板！<br><b>请在编辑器中按 Ctrl+V 粘贴</b>', 'o');
            }).catch(function(e) {
                console.log('[深研Lab] 剪贴板写入失败:', e);
                fallbackInject(editor, html);
            });
        } catch(e) {
            console.log('[深研Lab] ClipboardItem 不支持:', e);
            fallbackInject(editor, html);
        }

        // 填标题
        fillTitle(title);

        return {ok: true, msg: '📋 文章已复制到剪贴板！请在编辑器中按 <b>Ctrl+V</b> 粘贴'};
    }

    // 备用注入方式
    function fallbackInject(editor, html) {
        try {
            editor.focus();
            var sel = window.getSelection();
            var range = document.createRange();
            range.selectNodeContents(editor);
            sel.removeAllRanges();
            sel.addRange(range);
            document.execCommand('insertHTML', false, html);
            showStatus('✅ 文章已注入编辑器！', 'o');
        } catch(e) {
            showStatus('注入失败: ' + e.message + '。请手动复制粘贴。', 'e');
        }
    }

    function showStatus(msg, type) {
        var a = document.getElementById('sy-sta');
        if (a) a.innerHTML = '<div class="st s' + type + '">' + msg + '</div>';
    }

    // 使用 GM_xmlhttpRequest 抓取文章（绕过 CORS）
    function fetchArticle(url, callback) {
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function(resp) {
                if (resp.status === 200) {
                    callback(null, resp.responseText);
                } else {
                    callback('HTTP ' + resp.status);
                }
            },
            onerror: function(err) {
                callback('网络错误');
            }
        });
    }

    function fetchAndInject(url) {
        showStatus('正在获取文章...', 'i');
        fetchArticle(url, function(err, html) {
            if (err) {
                showStatus('获取失败: ' + err, 'e');
                return;
            }
            var title = extractTitle(html);
            var cleaned = cleanHtml(html);
            injectToEditor(cleaned, title);
        });
    }

    // 从 GitHub API 加载文章列表
    function loadArticleList() {
        var container = document.getElementById('sy-articles');
        if (!container) return;

        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://api.github.com/repos/edliuustc/deep-research-lab/contents/articles',
            onload: function(resp) {
                try {
                    var files = JSON.parse(resp.responseText);
                    var xueqiu = files.filter(function(f) { return f.name.endsWith('-xueqiu.html'); });
                    xueqiu.sort(function(a, b) { return b.name.localeCompare(a.name); });

                    if (!xueqiu.length) {
                        container.innerHTML = '<div class="st se">未找到雪球版文章</div>';
                        return;
                    }

                    container.innerHTML = '';
                    xueqiu.forEach(function(f) {
                        var match = f.name.match(/^(\d+)-(.+)-xueqiu\.html$/);
                        var num = match ? '#' + match[1] : '';
                        var slug = match ? match[2].replace(/-/g, ' ') : f.name;
                        var url = 'https://edliuustc.github.io/deep-research-lab/articles/' + f.name;

                        var div = document.createElement('div');
                        div.className = 'ai';
                        div.innerHTML = '<div class="at">' + num + ' ' + slug + '</div><div class="am">点击加载</div>';
                        div.addEventListener('click', function() {
                            document.getElementById('sy-url').value = url;
                            div.querySelector('.am').textContent = '加载中...';
                            fetchAndInject(url);
                        });
                        container.appendChild(div);
                    });
                    console.log('[深研Lab] 加载了', xueqiu.length, '篇文章');
                } catch(e) {
                    container.innerHTML = '<div class="st se">解析失败: ' + e.message + '</div>';
                }
            },
            onerror: function() {
                container.innerHTML = '<div class="st se">网络错误，无法加载文章列表</div>';
            }
        });
    }

    // ============ 创建 UI ============

    function createUI() {
        if (document.getElementById('shenyan-fab')) return;

        // FAB 按钮
        var fab = document.createElement('button');
        fab.id = 'shenyan-fab';
        fab.textContent = '📊';
        fab.title = '深研Lab 发布器';
        document.body.appendChild(fab);

        // 面板
        var panel = document.createElement('div');
        panel.id = 'shenyan-panel';
        panel.innerHTML =
            '<div class="sh"><span>\u{1F4CA} 深研Lab 发布器</span><span class="sc" id="sy-x">&times;</span></div>' +
            '<div class="sb">' +
            '<div class="st si">输入文章URL或从列表选择</div>' +
            '<input class="ui" id="sy-url" placeholder="GitHub Pages 文章URL..." value="">' +
            '<button class="btn bp" id="sy-go">\u{1F4E5} 获取并注入文章</button>' +
            '<div style="margin:16px 0 8px;font-weight:600;color:#666;font-size:13px">\u2500\u2500 文章列表（自动加载）\u2500\u2500</div>' +
            '<div id="sy-articles"><div class="st si">正在加载...</div></div>' +
            '<hr style="margin:16px 0;border:none;border-top:1px solid #eee">' +
            '<button class="btn bs" id="sy-paste">\u{1F4CB} 从剪贴板粘贴HTML</button>' +
            '<button class="btn bs" id="sy-detect">\u{1F50D} 检测编辑器</button>' +
            '<div id="sy-sta"></div>' +
            '</div>';
        document.body.appendChild(panel);

        // 事件绑定
        fab.addEventListener('click', function() {
            panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
        });

        document.getElementById('sy-x').addEventListener('click', function() {
            panel.style.display = 'none';
        });

        document.getElementById('sy-go').addEventListener('click', function() {
            var url = document.getElementById('sy-url').value.trim();
            if (!url) { showStatus('请输入URL', 'e'); return; }
            fetchAndInject(url);
        });

        document.getElementById('sy-paste').addEventListener('click', async function() {
            try {
                var text = await navigator.clipboard.readText();
                if (text.indexOf('<') >= 0 && text.indexOf('>') >= 0) {
                    var title = extractTitle(text);
                    var cleaned = cleanHtml(text);
                    injectToEditor(cleaned, title);
                } else {
                    showStatus('剪贴板不是HTML格式', 'e');
                }
            } catch(e) {
                showStatus('剪贴板读取失败: ' + e.message, 'e');
            }
        });

        document.getElementById('sy-detect').addEventListener('click', function() {
            var found = [];
            ['ql-editor','ProseMirror','w-e-text','editable'].forEach(function(cls) {
                var el = document.querySelector('.' + cls);
                if (el) found.push('.' + cls + ' (' + el.tagName + ', h:' + el.offsetHeight + ')');
            });
            document.querySelectorAll('[contenteditable="true"]').forEach(function(el) {
                found.push('contenteditable (' + el.tagName + '.' + (el.className||'').split(' ')[0] + ', h:' + el.offsetHeight + ')');
            });
            // 检测标题框
            var allInputs = document.querySelectorAll('input, textarea');
            allInputs.forEach(function(el) {
                var ph = el.placeholder || '';
                if (ph.indexOf('标题') >= 0 || ph.indexOf('title') >= 0) {
                    found.push('标题框: ' + el.tagName + '[placeholder="' + ph + '"]');
                }
            });
            if (found.length) {
                showStatus('检测到 ' + found.length + ' 个元素:<br>' + found.join('<br>'), 'o');
            } else {
                showStatus('未检测到编辑器/标题框', 'e');
            }
        });

        // 加载文章列表
        loadArticleList();

        console.log('[深研Lab] 发布器 v2.0 已加载 ✅');
    }

    // ============ 注册菜单 ============
    GM_registerMenuCommand('📊 打开深研Lab发布器', function() {
        createUI();
        var panel = document.getElementById('shenyan-panel');
        if (panel) panel.style.display = 'block';
    });

    // ============ 初始化 ============
    // 延迟加载，等 SPA 渲染
    setTimeout(createUI, 1000);
    // 保底3秒
    setTimeout(function() {
        if (!document.getElementById('shenyan-fab')) createUI();
    }, 3000);

})();
