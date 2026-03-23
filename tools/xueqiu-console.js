// ========================================
// 深研Lab 雪球发布器 - Console 版
// 使用方法：在雪球写文章页面 F12 → Console → 粘贴 → 回车
// ========================================
(function(){
  // 如果已存在就移除
  var old = document.getElementById('shenyan-fab');
  if(old) old.remove();
  var oldP = document.getElementById('shenyan-panel');
  if(oldP) oldP.remove();

  // 样式
  var style = document.createElement('style');
  style.textContent = `
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
    #shenyan-fab{position:fixed;bottom:30px;right:30px;width:56px;height:56px;background:#b71c1c;color:#fff;border:none;border-radius:50%;font-size:24px;cursor:pointer;box-shadow:0 4px 16px rgba(183,28,28,.4);z-index:99998;display:flex;align-items:center;justify-content:center}
    #shenyan-fab:hover{transform:scale(1.1);box-shadow:0 6px 20px rgba(183,28,28,.6)}
  `;
  document.head.appendChild(style);

  // 工具函数
  function cleanHtml(html){
    var p = new DOMParser();
    var doc = p.parseFromString(html,'text/html');
    ['head','script','style','meta','link','nav'].forEach(function(t){
      doc.querySelectorAll(t).forEach(function(e){e.remove()});
    });
    // 移除二维码/footer
    doc.querySelectorAll('[class*="qrcode"],[class*="footer"],[class*="subscribe"],[class*="qr-"]').forEach(function(e){e.remove()});
    var c = doc.body ? doc.body.innerHTML : html;
    c = c.replace(/background\s*:\s*linear-gradient[^;]+;?/gi,'');
    c = c.replace(/display\s*:\s*flex[^;]*;?/gi,'');
    c = c.replace(/display\s*:\s*grid[^;]*;?/gi,'');
    c = c.replace(/position\s*:\s*(absolute|fixed)[^;]*;?/gi,'');
    return c;
  }

  function extractTitle(html){
    var m = html.match(/<h1[^>]*>(.*?)<\/h1>/i) || html.match(/<title>(.*?)<\/title>/i);
    return m ? m[1].replace(/<[^>]+>/g,'').trim() : '';
  }

  function injectToEditor(html, title){
    // 查找编辑器
    var editors = [
      document.querySelector('.ql-editor'),
      document.querySelector('[contenteditable="true"]'),
      document.querySelector('.ProseMirror'),
      document.querySelector('.w-e-text'),
      document.querySelector('[role="textbox"]'),
      document.querySelector('.editable'),
    ].filter(Boolean);

    // 也搜索 iframe 内的编辑器
    document.querySelectorAll('iframe').forEach(function(f){
      try{
        var d = f.contentDocument;
        var e = d.querySelector('.ql-editor') || d.querySelector('[contenteditable="true"]');
        if(e) editors.push(e);
      }catch(err){}
    });

    if(!editors.length){
      editors = Array.from(document.querySelectorAll('[contenteditable]')).filter(function(e){
        return e.offsetHeight > 100;
      });
    }

    if(!editors.length) return {ok:false,msg:'未找到编辑器！请确认已打开雪球"写文章"页面。'};

    var editor = editors[0];
    console.log('[深研Lab] 找到编辑器:', editor.tagName, editor.className);

    // 方法1：通过 clipboardData 模拟粘贴（最兼容富文本编辑器）
    try {
      editor.focus();
      // 选中编辑器全部内容
      var sel = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(editor);
      sel.removeAllRanges();
      sel.addRange(range);

      // 创建 paste 事件
      var pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: new DataTransfer()
      });
      pasteEvent.clipboardData.setData('text/html', html);
      pasteEvent.clipboardData.setData('text/plain', editor.textContent || '');

      var handled = !editor.dispatchEvent(pasteEvent);
      if (handled) {
        console.log('[深研Lab] 方法1成功：ClipboardEvent paste');
        return {ok:true, msg:'✅ 文章已通过模拟粘贴注入！请检查格式后发布。'};
      }
    } catch(e) {
      console.log('[深研Lab] 方法1失败:', e.message);
    }

    // 方法2：使用 execCommand insertHTML
    try {
      editor.focus();
      var sel = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(editor);
      sel.removeAllRanges();
      sel.addRange(range);
      var ok = document.execCommand('insertHTML', false, html);
      if (ok) {
        console.log('[深研Lab] 方法2成功：execCommand insertHTML');
        return {ok:true, msg:'✅ 文章已通过insertHTML注入！请检查格式后发布。'};
      }
    } catch(e) {
      console.log('[深研Lab] 方法2失败:', e.message);
    }

    // 方法3：写入剪贴板，提示用户手动粘贴
    try {
      var blob = new Blob([html], {type: 'text/html'});
      var item = new ClipboardItem({'text/html': blob, 'text/plain': new Blob([html.replace(/<[^>]+>/g, '')], {type: 'text/plain'})});
      navigator.clipboard.write([item]).then(function(){
        showStatus('✅ 已复制到剪贴板！请在编辑器中按 <strong>Ctrl+V</strong> 粘贴', 'o');
      });
      console.log('[深研Lab] 方法3：已写入剪贴板，等待用户粘贴');
      return {ok:true, msg:'📋 已复制到剪贴板！请点击编辑器内部，然后按 <strong>Ctrl+V</strong> 粘贴。'};
    } catch(e) {
      console.log('[深研Lab] 方法3失败:', e.message);
    }

    return {ok:false, msg:'所有注入方法都失败了，请手动复制粘贴。'};
  }

  function showStatus(msg, type){
    var a = document.getElementById('sy-sta');
    if(a) a.innerHTML = '<div class="st s'+type+'">'+msg+'</div>';
  }

  function fetchAndInject(url){
    showStatus('正在获取文章...','i');
    fetch(url).then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.text();
    }).then(function(html){
      var title = extractTitle(html);
      var cleaned = cleanHtml(html);
      var result = injectToEditor(cleaned, title);
      showStatus(result.msg, result.ok?'o':'e');
    }).catch(function(err){
      showStatus('获取失败: '+err.message+'。尝试跨域方式...','e');
      // 如果 fetch 被 CORS 拦截，提示用户手动复制
      showStatus('CORS限制，请手动操作：<br>1. 新标签页打开文章URL<br>2. Ctrl+A全选 → Ctrl+C复制<br>3. 回来点"从剪贴板粘贴HTML"','e');
    });
  }

  // 面板
  var panel = document.createElement('div');
  panel.id = 'shenyan-panel';
  panel.innerHTML = `
    <div class="sh"><span>📊 深研Lab 发布器</span><span class="sc" id="sy-x">&times;</span></div>
    <div class="sb">
      <div class="st si">输入文章URL或选择预置文章</div>
      <input class="ui" id="sy-url" placeholder="GitHub Pages 文章URL..." value="">
      <button class="btn bp" id="sy-go">📥 获取并注入文章</button>
      <div style="margin:16px 0 8px;font-weight:600;color:#666;font-size:13px">── 文章列表（自动加载）──</div>
      <div id="sy-articles"><div class="st si">正在加载...</div></div>
      <hr style="margin:16px 0;border:none;border-top:1px solid #eee">
      <button class="btn bs" id="sy-paste">📋 从剪贴板粘贴HTML</button>
      <button class="btn bs" id="sy-detect">🔍 检测编辑器</button>
      <div id="sy-sta"></div>
    </div>
  `;
  document.body.appendChild(panel);

  // FAB
  var fab = document.createElement('button');
  fab.id = 'shenyan-fab';
  fab.textContent = '📊';
  fab.title = '深研Lab 发布器';
  document.body.appendChild(fab);

  // 事件
  fab.onclick = function(){ panel.style.display = panel.style.display==='block'?'none':'block'; };
  document.getElementById('sy-x').onclick = function(){ panel.style.display='none'; };

  document.getElementById('sy-go').onclick = function(){
    var url = document.getElementById('sy-url').value.trim();
    if(!url){ showStatus('请输入URL','e'); return; }
    fetchAndInject(url);
  };

  panel.querySelectorAll('.ai').forEach(function(item){
    item.onclick = function(){
      var url = this.dataset.url;
      document.getElementById('sy-url').value = url;
      fetchAndInject(url);
    };
  });

  // 自动从 GitHub API 加载 *-xueqiu.html 文章列表
  function loadArticleList(){
    var container = document.getElementById('sy-articles');
    fetch('https://api.github.com/repos/edliuustc/deep-research-lab/contents/articles')
      .then(function(r){ return r.json(); })
      .then(function(files){
        // 筛选 -xueqiu.html 文件，按名称倒序（新文章在前）
        var xueqiu = files.filter(function(f){ return f.name.endsWith('-xueqiu.html'); });
        xueqiu.sort(function(a,b){ return b.name.localeCompare(a.name); });

        if(!xueqiu.length){
          container.innerHTML = '<div class="st se">未找到雪球版文章（*-xueqiu.html）</div>';
          return;
        }

        container.innerHTML = '';
        xueqiu.forEach(function(f){
          // 从文件名提取编号和关键词: 002-petrochina-xueqiu.html -> #002 petrochina
          var match = f.name.match(/^(\d+)-(.+)-xueqiu\.html$/);
          var num = match ? '#' + match[1] : '';
          var slug = match ? match[2].replace(/-/g, ' ') : f.name;
          var url = 'https://edliuustc.github.io/deep-research-lab/articles/' + f.name;

          var div = document.createElement('div');
          div.className = 'ai';
          div.dataset.url = url;
          div.innerHTML = '<div class="at">' + num + ' ' + slug + '</div><div class="am">点击加载 →</div>';
          div.onclick = function(){
            document.getElementById('sy-url').value = url;
            // 先 fetch 获取实际标题
            div.querySelector('.am').textContent = '加载中...';
            fetchAndInject(url);
          };
          container.appendChild(div);
        });
        console.log('[深研Lab] 加载了', xueqiu.length, '篇雪球版文章');
      })
      .catch(function(err){
        container.innerHTML = '<div class="st se">加载失败: ' + err.message + '</div>';
      });
  }
  loadArticleList();

  document.getElementById('sy-paste').onclick = async function(){
    try{
      var text = await navigator.clipboard.readText();
      if(text.includes('<')&&text.includes('>')){
        var title = extractTitle(text);
        var cleaned = cleanHtml(text);
        var result = injectToEditor(cleaned, title);
        showStatus(result.msg, result.ok?'o':'e');
      } else {
        showStatus('剪贴板不是HTML。可以试试：<br>1. 浏览器打开文章页面<br>2. Ctrl+A → Ctrl+C<br>3. 再点此按钮','e');
      }
    }catch(e){
      showStatus('剪贴板读取失败: '+e.message,'e');
    }
  };

  document.getElementById('sy-detect').onclick = function(){
    var found = [];
    ['ql-editor','ProseMirror','w-e-text','editable'].forEach(function(cls){
      var el = document.querySelector('.'+cls);
      if(el) found.push('.'+cls+' ('+el.tagName+', h:'+el.offsetHeight+')');
    });
    document.querySelectorAll('[contenteditable="true"]').forEach(function(el){
      found.push('contenteditable ('+el.tagName+'.'+el.className.split(' ')[0]+', h:'+el.offsetHeight+')');
    });
    document.querySelectorAll('[role="textbox"]').forEach(function(el){
      found.push('role=textbox ('+el.tagName+'.'+el.className.split(' ')[0]+', h:'+el.offsetHeight+')');
    });
    if(found.length){
      showStatus('找到 '+found.length+' 个编辑器:<br>'+found.join('<br>'),'o');
    } else {
      showStatus('未检测到编辑器元素','e');
    }
  };

  console.log('[深研Lab] 发布器已加载 ✅');
  showStatus('发布器就绪 ✅','o');
})();
