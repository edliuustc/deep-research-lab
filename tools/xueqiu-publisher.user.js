// ==UserScript==
// @name         深研Lab 雪球文章发布器
// @namespace    https://github.com/edliuustc/deep-research-lab
// @version      1.0
// @description  一键将深研Lab文章（带格式）发布到雪球长文编辑器
// @author       深研Lab
// @match        https://xueqiu.com/*
// @match        https://mp.xueqiu.com/*
// @match        *://xueqiu.com/*
// @match        *://mp.xueqiu.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @connect      edliuustc.github.io
// @connect      raw.githubusercontent.com
// ==/UserScript==

(function() {
    'use strict';

    // ============ 配置 ============
    const GITHUB_INDEX = 'https://edliuustc.github.io/deep-research-lab/';
    const RAW_BASE = 'https://raw.githubusercontent.com/edliuustc/deep-research-lab/main/articles/';

    // ============ 样式 ============
    GM_addStyle(`
        #shenyan-panel {
            position: fixed;
            top: 60px;
            right: 20px;
            width: 360px;
            max-height: 80vh;
            background: #fff;
            border: 2px solid #b71c1c;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.2);
            z-index: 99999;
            font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
            overflow: hidden;
        }
        #shenyan-panel .sy-header {
            background: #b71c1c;
            color: white;
            padding: 12px 16px;
            font-size: 16px;
            font-weight: 700;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #shenyan-panel .sy-header .sy-close {
            cursor: pointer;
            font-size: 20px;
            opacity: 0.8;
        }
        #shenyan-panel .sy-header .sy-close:hover { opacity: 1; }
        #shenyan-panel .sy-body {
            padding: 16px;
            overflow-y: auto;
            max-height: 60vh;
        }
        #shenyan-panel .sy-btn {
            display: block;
            width: 100%;
            padding: 10px;
            margin: 8px 0;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        #shenyan-panel .sy-btn-primary {
            background: #b71c1c;
            color: white;
        }
        #shenyan-panel .sy-btn-primary:hover { background: #d32f2f; }
        #shenyan-panel .sy-btn-secondary {
            background: #f5f5f5;
            color: #333;
            border: 1px solid #ddd;
        }
        #shenyan-panel .sy-btn-secondary:hover { background: #eee; }
        #shenyan-panel .sy-article-item {
            padding: 10px 12px;
            margin: 6px 0;
            background: #f9f9f9;
            border-radius: 8px;
            cursor: pointer;
            border-left: 3px solid #b71c1c;
            transition: all 0.2s;
        }
        #shenyan-panel .sy-article-item:hover { background: #fff3f3; }
        #shenyan-panel .sy-article-item .sy-title { font-weight: 600; font-size: 14px; }
        #shenyan-panel .sy-article-item .sy-meta { font-size: 12px; color: #999; margin-top: 4px; }
        #shenyan-panel .sy-status {
            padding: 10px;
            margin: 8px 0;
            border-radius: 8px;
            font-size: 13px;
        }
        #shenyan-panel .sy-status-ok { background: #e8f5e9; color: #1b5e20; }
        #shenyan-panel .sy-status-err { background: #fce4ec; color: #b71c1c; }
        #shenyan-panel .sy-status-info { background: #e3f2fd; color: #1565c0; }
        #shenyan-panel .sy-url-input {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 13px;
            box-sizing: border-box;
            margin: 8px 0;
        }
        #shenyan-fab {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 56px;
            height: 56px;
            background: #b71c1c;
            color: white;
            border: none;
            border-radius: 50%;
            font-size: 24px;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(183,28,28,0.4);
            z-index: 99998;
            transition: all 0.3s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        #shenyan-fab:hover { transform: scale(1.1); box-shadow: 0 6px 20px rgba(183,28,28,0.6); }
    `);

    // ============ 工具函数 ============

    // 清理HTML，适配雪球编辑器
    function cleanHtmlForXueqiu(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // 移除 head, script, style, meta 等
        ['head', 'script', 'style', 'meta', 'link', 'nav', 'footer'].forEach(tag => {
            doc.querySelectorAll(tag).forEach(el => el.remove());
        });

        // 移除二维码相关
        doc.querySelectorAll('[class*="qrcode"], [class*="qr-"], img[src*="qrcode"]').forEach(el => el.remove());

        // 移除公众号专属引导（保留内容本身）
        doc.querySelectorAll('[class*="footer"], [class*="subscribe"]').forEach(el => el.remove());

        // 获取 body 内容
        let content = doc.body ? doc.body.innerHTML : html;

        // 清理行内样式中雪球不支持的属性
        content = content.replace(/background\s*:\s*linear-gradient[^;]+;?/gi, '');
        content = content.replace(/display\s*:\s*flex[^;]*;?/gi, '');
        content = content.replace(/display\s*:\s*grid[^;]*;?/gi, '');
        content = content.replace(/position\s*:\s*(absolute|fixed)[^;]*;?/gi, '');

        return content;
    }

    // 将HTML注入到雪球编辑器
    function injectToEditor(html, title) {
        // 尝试找到雪球的编辑器
        // 雪球长文编辑器通常是 contenteditable 的 div 或者一个 iframe
        const editors = [
            // Quill 编辑器
            document.querySelector('.ql-editor'),
            // 通用 contenteditable
            document.querySelector('[contenteditable="true"]'),
            // 可能的 iframe 内编辑器
            ...Array.from(document.querySelectorAll('iframe')).map(f => {
                try { return f.contentDocument.querySelector('[contenteditable="true"]') || f.contentDocument.querySelector('.ql-editor'); }
                catch(e) { return null; }
            }).filter(Boolean),
        ];

        const editor = editors[0];
        if (!editor) {
            return { ok: false, msg: '未找到编辑器。请先打开雪球的"写文章"页面。' };
        }

        // 注入内容
        editor.innerHTML = html;

        // 触发编辑器的 input 事件，让框架感知到内容变化
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));

        // 尝试填写标题
        if (title) {
            const titleInputs = [
                document.querySelector('input[placeholder*="标题"]'),
                document.querySelector('input[name="title"]'),
                document.querySelector('.article-title input'),
                document.querySelector('textarea[placeholder*="标题"]'),
            ].filter(Boolean);

            if (titleInputs[0]) {
                titleInputs[0].value = title;
                titleInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
            }
        }

        return { ok: true, msg: '文章已注入编辑器！请检查格式后点击发布。' };
    }

    // 从URL抓取文章
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
                callback('网络错误: ' + err.error);
            }
        });
    }

    // 从HTML中提取标题
    function extractTitle(html) {
        const m = html.match(/<h1[^>]*>(.*?)<\/h1>/i) || html.match(/<title>(.*?)<\/title>/i);
        if (m) {
            return m[1].replace(/<[^>]+>/g, '').trim();
        }
        return '';
    }

    // ============ UI ============

    let panelVisible = false;

    function createPanel() {
        if (document.getElementById('shenyan-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'shenyan-panel';
        panel.innerHTML = `
            <div class="sy-header">
                <span>📊 深研Lab 发布器</span>
                <span class="sy-close" id="sy-close">&times;</span>
            </div>
            <div class="sy-body" id="sy-body">
                <div class="sy-status sy-status-info">请输入文章URL或从列表选择</div>

                <input type="text" class="sy-url-input" id="sy-url-input"
                    placeholder="GitHub Pages 文章URL..."
                    value="https://edliuustc.github.io/deep-research-lab/articles/">

                <button class="sy-btn sy-btn-primary" id="sy-fetch-btn">📥 获取并注入文章</button>

                <div style="margin: 16px 0 8px; font-weight: 600; color: #666; font-size: 13px;">── 或选择最近文章 ──</div>

                <div class="sy-article-item" data-url="https://edliuustc.github.io/deep-research-lab/articles/002-petrochina.html">
                    <div class="sy-title">#002 中国石油(601857)：地缘风暴下的三桶油传奇</div>
                    <div class="sy-meta">2026-03-23</div>
                </div>

                <div class="sy-article-item" data-url="https://edliuustc.github.io/deep-research-lab/articles/001-yuanjie-tech.html">
                    <div class="sy-title">#001 源杰科技(688498)：从百元到千元</div>
                    <div class="sy-meta">2026-03-23</div>
                </div>

                <hr style="margin: 16px 0; border: none; border-top: 1px solid #eee;">

                <button class="sy-btn sy-btn-secondary" id="sy-paste-btn">📋 从剪贴板粘贴HTML</button>

                <div id="sy-status-area"></div>
            </div>
        `;
        document.body.appendChild(panel);

        // 事件绑定
        document.getElementById('sy-close').addEventListener('click', togglePanel);

        document.getElementById('sy-fetch-btn').addEventListener('click', function() {
            const url = document.getElementById('sy-url-input').value.trim();
            if (!url) {
                showStatus('请输入文章URL', 'err');
                return;
            }
            showStatus('正在获取文章...', 'info');
            fetchArticle(url, function(err, html) {
                if (err) {
                    showStatus('获取失败: ' + err, 'err');
                    return;
                }
                const title = extractTitle(html);
                const cleaned = cleanHtmlForXueqiu(html);
                const result = injectToEditor(cleaned, title);
                showStatus(result.msg, result.ok ? 'ok' : 'err');
            });
        });

        // 文章选择
        panel.querySelectorAll('.sy-article-item').forEach(item => {
            item.addEventListener('click', function() {
                const url = this.dataset.url;
                document.getElementById('sy-url-input').value = url;
                showStatus('正在获取: ' + this.querySelector('.sy-title').textContent, 'info');
                fetchArticle(url, function(err, html) {
                    if (err) {
                        showStatus('获取失败: ' + err, 'err');
                        return;
                    }
                    const title = extractTitle(html);
                    const cleaned = cleanHtmlForXueqiu(html);
                    const result = injectToEditor(cleaned, title);
                    showStatus(result.msg, result.ok ? 'ok' : 'err');
                });
            });
        });

        // 剪贴板粘贴
        document.getElementById('sy-paste-btn').addEventListener('click', async function() {
            try {
                const text = await navigator.clipboard.readText();
                if (text.includes('<') && text.includes('>')) {
                    const title = extractTitle(text);
                    const cleaned = cleanHtmlForXueqiu(text);
                    const result = injectToEditor(cleaned, title);
                    showStatus(result.msg, result.ok ? 'ok' : 'err');
                } else {
                    showStatus('剪贴板内容不是HTML格式', 'err');
                }
            } catch(e) {
                showStatus('无法读取剪贴板: ' + e.message, 'err');
            }
        });
    }

    function showStatus(msg, type) {
        const area = document.getElementById('sy-status-area');
        if (area) {
            area.innerHTML = `<div class="sy-status sy-status-${type}">${msg}</div>`;
        }
    }

    function togglePanel() {
        panelVisible = !panelVisible;
        const panel = document.getElementById('shenyan-panel');
        if (panel) {
            panel.style.display = panelVisible ? 'block' : 'none';
        }
    }

    // FAB 按钮（浮动操作按钮）
    function createFAB() {
        const fab = document.createElement('button');
        fab.id = 'shenyan-fab';
        fab.innerHTML = '📊';
        fab.title = '深研Lab 发布器';
        fab.addEventListener('click', function() {
            createPanel();
            togglePanel();
        });
        document.body.appendChild(fab);
    }

    // ============ 注册菜单命令 ============
    GM_registerMenuCommand('📊 打开深研Lab发布器', function() {
        createPanel();
        togglePanel();
    });

    // ============ 初始化 ============
    // 延迟加载，等 SPA 页面完全渲染
    function init() {
        console.log('[深研Lab] 脚本已加载，当前URL:', location.href);
        createFAB();
    }

    // 多重保障：立即尝试 + 延迟重试
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(init, 1000);
        });
    } else {
        setTimeout(init, 500);
    }

    // 再加一层保障：如果是 SPA 路由切换，MutationObserver 重新检查
    let fabCreated = false;
    const observer = new MutationObserver(function() {
        if (!fabCreated && !document.getElementById('shenyan-fab')) {
            console.log('[深研Lab] MutationObserver 触发，创建FAB');
            createFAB();
            fabCreated = true;
        }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    // 最终保底：3秒后强制创建
    setTimeout(function() {
        if (!document.getElementById('shenyan-fab')) {
            console.log('[深研Lab] 3秒保底触发');
            createFAB();
        }
    }, 3000);

})();
