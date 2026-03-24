"use client"

export default function AIAssistantPage() {
  return (
    <div 
      dangerouslySetInnerHTML={{ 
        __html: `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>留学生签证AI助手</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #ffffff 0%, #f5f5f7 50%, #e8e8ed 100%);
            height: 100vh;
            display: flex;
            flex-direction: column;
            color: #1d1d1f;
        }
        
        .header {
            background: rgba(255, 255, 255, 0.72);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(0, 0, 0, 0.1);
            padding: 16px 0;
            text-align: center;
            position: sticky;
            top: 0;
            z-index: 100;
        }
        
        .header h1 {
            font-size: 24px;
            font-weight: 600;
            background: linear-gradient(135deg, #1d1d1f 0%, #86868b 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        
        .chat-container {
            flex: 1;
            overflow-y: auto;
            padding: 24px 0;
            scroll-behavior: smooth;
            display: flex;
            flex-direction: column;
        }
        
        .chat-container::-webkit-scrollbar {
            width: 6px;
        }
        
        .chat-container::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .chat-container::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 3px;
        }
        
        .chat-container::-webkit-scrollbar-thumb:hover {
            background: rgba(0, 0, 0, 0.3);
        }
        
        .welcome-message {
            background: rgba(255, 255, 255, 0.5);
            border-radius: 16px;
            margin: 0 24px 24px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
        
        #dynamicMessages {
            flex: 1;
            display: flex;
            flex-direction: column;
        }
        
        .message {
            display: flex;
            padding: 24px;
            gap: 16px;
            max-width: 800px;
            margin: 0 auto;
            animation: fadeIn 0.5s ease-out;
            width: 100%;
        }
        
        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .message.user {
            background: transparent;
        }
        
        .message.assistant {
            background: transparent;
        }
        
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 600;
            font-size: 16px;
            flex-shrink: 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .user .avatar {
            background: linear-gradient(135deg, #1d1d1f 0%, #424245 100%);
            color: white;
        }
        
        .assistant .avatar {
            background: linear-gradient(135deg, #ffffff 0%, #f5f5f7 100%);
            color: #1d1d1f;
            border: 1px solid rgba(0, 0, 0, 0.1);
        }
        
        .message-content {
            flex: 1;
            line-height: 1.7;
            font-size: 16px;
            font-weight: 400;
            letter-spacing: -0.016em;
        }
        
        .message-content p {
            margin-bottom: 16px;
        }
        
        .message-content p:last-child {
            margin-bottom: 0;
        }
        
        .message-content ul, .message-content ol {
            margin: 16px 0;
            padding-left: 24px;
        }
        
        .message-content li {
            margin-bottom: 12px;
        }
        
        .message-content strong {
            font-weight: 600;
            color: #000;
        }
        
        .input-container {
            background: rgba(255, 255, 255, 0.72);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border-top: 1px solid rgba(0, 0, 0, 0.1);
            padding: 20px;
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
        }
        
        .input-wrapper {
            max-width: 800px;
            margin: 0 auto;
        }
        
        .options-row {
            display: flex;
            gap: 16px;
            margin-bottom: 16px;
            flex-wrap: wrap;
            align-items: center;
        }
        
        .select-wrapper {
            flex: 1;
            min-width: 120px;
        }
        
        .select-wrapper label {
            display: block;
            font-size: 11px;
            color: #86868b;
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-weight: 600;
        }
        
        .select-wrapper select {
            width: 100%;
            padding: 10px 14px;
            border: 1px solid rgba(0, 0, 0, 0.12);
            border-radius: 8px;
            font-size: 15px;
            background-color: rgba(255, 255, 255, 0.8);
            color: #1d1d1f;
            transition: all 0.2s ease;
            -webkit-appearance: none;
            appearance: none;
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 10px center;
            background-size: 16px;
            padding-right: 36px;
        }
        
        .select-wrapper select:hover {
            border-color: rgba(0, 0, 0, 0.2);
            background-color: rgba(255, 255, 255, 0.95);
        }
        
        .select-wrapper select:focus {
            outline: none;
            border-color: #0071e3;
            box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
        }
        
        .checkbox-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
            padding-top: 18px;
        }
        
        .checkbox-wrapper input[type="checkbox"] {
            width: 20px;
            height: 20px;
            cursor: pointer;
            accent-color: #0071e3;
        }
        
        .checkbox-wrapper label {
            font-size: 15px;
            color: #1d1d1f;
            cursor: pointer;
        }
        
        .input-row {
            display: flex;
            gap: 12px;
            align-items: flex-end;
        }
        
        .input-field {
            flex: 1;
            position: relative;
        }
        
        .input-field textarea {
            width: 100%;
            padding: 14px 18px;
            border: 1px solid rgba(0, 0, 0, 0.12);
            border-radius: 12px;
            font-size: 16px;
            resize: none;
            font-family: inherit;
            line-height: 1.5;
            min-height: 52px;
            max-height: 200px;
            overflow-y: auto;
            background: rgba(255, 255, 255, 0.8);
            transition: all 0.2s ease;
        }
        
        .input-field textarea:hover {
            border-color: rgba(0, 0, 0, 0.2);
            background: rgba(255, 255, 255, 0.95);
        }
        
        .input-field textarea:focus {
            outline: none;
            border-color: #0071e3;
            box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
            background: white;
        }
        
        .send-button {
            padding: 14px 24px;
            background: linear-gradient(135deg, #1d1d1f 0%, #424245 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        
        .send-button:hover:not(:disabled) {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        .send-button:active {
            transform: translateY(0);
        }
        
        .send-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            box-shadow: none;
        }
        
        .typing-indicator {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 8px 12px;
            background: rgba(0, 0, 0, 0.05);
            border-radius: 18px;
        }
        
        .typing-indicator span {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #86868b;
            animation: typing 1.4s infinite;
        }
        
        .typing-indicator span:nth-child(2) {
            animation-delay: 0.2s;
        }
        
        .typing-indicator span:nth-child(3) {
            animation-delay: 0.4s;
        }
        
        @keyframes typing {
            0%, 60%, 100% {
                opacity: 0.3;
                transform: scale(0.8);
            }
            30% {
                opacity: 1;
                transform: scale(1);
            }
        }
        
        .error-message {
            background: rgba(255, 59, 48, 0.1);
            color: #ff3b30;
            padding: 16px;
            border-radius: 12px;
            margin-top: 16px;
            font-size: 15px;
            border: 1px solid rgba(255, 59, 48, 0.2);
        }
        
        .references {
            margin-top: 20px;
            padding: 16px;
            background: rgba(0, 122, 255, 0.05);
            border-radius: 12px;
            font-size: 14px;
            border: 1px solid rgba(0, 122, 255, 0.1);
        }
        
        .references h4 {
            color: #007aff;
            margin-bottom: 12px;
            font-size: 15px;
            font-weight: 600;
        }
        
        .reference-item {
            margin-bottom: 12px;
            padding: 12px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
        }
        
        .reference-item .question {
            font-weight: 600;
            color: #1d1d1f;
            margin-bottom: 6px;
        }
        
        .reference-item .answer {
            color: #6e6e73;
            font-size: 14px;
        }
        
        @media (max-width: 768px) {
            .options-row {
                flex-direction: column;
            }
            
            .select-wrapper {
                width: 100%;
                min-width: unset;
            }
            
            .message {
                padding: 16px;
            }
            
            .input-container {
                padding: 16px;
            }
            
            .header h1 {
                font-size: 20px;
            }
        }
        
        @media (max-width: 1024px) and (min-width: 769px) {
            .options-row {
                flex-wrap: wrap;
            }
            
            .select-wrapper {
                flex: 1 1 calc(50% - 8px);
                min-width: 200px;
            }
        }
        
        .message-content strong {
            font-weight: 600;
            color: #000;
        }
        
        .stream-text {
            line-height: 1.7;
            font-size: 16px;
            animation: fadeIn 0.3s ease-out;
            position: relative;
        }
        
        .stream-text.typing::after {
            content: '|';
            position: relative;
            display: inline-block;
            margin-left: 2px;
            animation: blink 1s infinite;
            font-weight: bold;
            color: #007AFF;
        }
        
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
        
        .stream-text p {
            margin-bottom: 16px;
            opacity: 0.9;
            transition: opacity 0.3s ease;
        }
        
        .stream-text p:last-child {
            margin-bottom: 0;
            opacity: 1;
        }
        
        .stream-text ul, .stream-text ol {
            margin: 16px 0;
            padding-left: 24px;
            opacity: 0.9;
            transition: opacity 0.3s ease;
        }
        
        .stream-text ul:hover, .stream-text ol:hover {
            opacity: 1;
        }
        
        .stream-text li {
            margin-bottom: 12px;
            position: relative;
        }
        
        .stream-text li::before {
            content: '';
            position: absolute;
            left: -20px;
            top: 8px;
            width: 6px;
            height: 6px;
            background: #007AFF;
            border-radius: 50%;
            opacity: 0.6;
            transition: all 0.3s ease;
        }
        
        .stream-text li:hover::before {
            opacity: 1;
            transform: scale(1.2);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>留学生签证AI助手</h1>
    </div>
    
    <div class="chat-container" id="chatContainer">
        <!-- 欢迎消息 -->
        <div class="message assistant welcome-message">
            <div class="avatar">AI</div>
            <div class="message-content">
                <p>我可以帮助你解答关于<strong>英国、美国、申根、法国</strong>等国家的留学中遇到的签证问题，包括：</p>
                <ul>
                    <li>📋 签证申请流程和材料准备</li>
                    <li>💰 资金证明和财务要求</li>
                    <li>🎤 面试技巧和常见问题</li>
                    <li>📅 时间规划和注意事项</li>
                    <li>🚨 拒签原因分析和申诉建议</li>
                </ul>
                <p>请问有什么可以帮助你的吗？</p>
            </div>
        </div>
        <!-- 动态消息容器 -->
        <div id="dynamicMessages"></div>
    </div>
    
    <div class="input-container">
        <div class="input-wrapper">
            <div class="options-row">
                <div class="select-wrapper">
                    <label for="visa-type">签证类型</label>
                    <select id="visa-type">
                        <option value="">请选择签证类型</option>
                        <option value="student">学生签证</option>
                        <option value="tourist">旅游签证</option>
                        <option value="business">商务签证</option>
                        <option value="work">工作签证</option>
                        <option value="family">家庭团聚签证</option>
                    </select>
                </div>
                <div class="select-wrapper">
                    <label for="country">申请国家</label>
                    <select id="country">
                        <option value="">请选择国家</option>
                        <option value="uk">英国</option>
                        <option value="us">美国</option>
                        <option value="france">法国</option>
                        <option value="canada">加拿大</option>
                        <option value="australia">澳大利亚</option>
                        <option value="japan">日本</option>
                        <option value="korea">韩国</option>
                        <option value="newzealand">新西兰</option>
                    </select>
                </div>
                <div class="select-wrapper">
                    <label for="location">所在地</label>
                    <select id="location">
                        <option value="china">中国大陆</option>
                        <option value="uk">英国</option>
                        <option value="us">美国</option>
                        <option value="australia">澳大利亚</option>
                        <option value="europe">欧洲</option>
                        <option value="newzealand">新西兰</option>
                        <option value="canada">加拿大</option>
                    </select>
                </div>
                <div class="select-wrapper">
                    <label for="applicant-status">申请人身份</label>
                    <select id="applicant-status">
                        <option value="student">学生</option>
                        <option value="employed">在职</option>
                        <option value="retired">退休</option>
                        <option value="freelancer">自由职业</option>
                        <option value="unemployed">待业</option>
                    </select>
                </div>
            </div>
            <div class="input-row">
                <div class="input-field">
                    <textarea id="questionInput" placeholder="请输入你的签证问题..." rows="1"></textarea>
                </div>
                <button id="sendButton" class="send-button" onclick="sendMessage()">发送</button>
            </div>
        </div>
    </div>
    
    <script>
        let isProcessing = false;
        
        // 自动调整输入框高度
        const textarea = document.getElementById('questionInput');
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
        
        // 回车发送消息
        textarea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        function addMessage(role, content) {
            const dynamicMessages = document.getElementById('dynamicMessages');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${role}\`;
            
            const avatarDiv = document.createElement('div');
            avatarDiv.className = 'avatar';
            avatarDiv.textContent = role === 'user' ? '你' : 'AI';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            messageDiv.appendChild(avatarDiv);
            messageDiv.appendChild(contentDiv);
            dynamicMessages.appendChild(messageDiv);
            
            return contentDiv;
        }
        
        function formatContent(text) {
            // 将文本转换为段落和列表
            const lines = text.split('\\n');
            let html = '';
            let inList = false;
            let listItems = [];
            
            lines.forEach(line => {
                line = line.trim();
                if (!line) return;
                
                // 处理列表项（支持多种列表标记）
                if (line.match(/^[•\\-\\*\\d][\\.\\)]s+/) || line.startsWith('• ')) {
                    if (!inList) {
                        if (listItems.length > 0) {
                            html += '<ul>' + listItems.join('') + '</ul>';
                        }
                        inList = true;
                        listItems = [];
                    }
                    const itemContent = line.replace(/^[•\\-\\*\\d][\\.\\)]s+/, '').replace(/^• /, '');
                    listItems.push(\`<li>\${itemContent}</li>\`);
                } else {
                    // 结束列表
                    if (inList) {
                        html += '<ul>' + listItems.join('') + '</ul>';
                        inList = false;
                        listItems = [];
                    }
                    
                    // 处理加粗文本
                    line = line.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
                    // 处理标题
                    if (line.startsWith('#')) {
                        const level = line.match(/^#+/)[0].length;
                        const title = line.replace(/^#+\\s+/, '');
                        html += \`<h\${level}>\${title}</h\${level}>\`;
                    } else {
                        html += \`<p>\${line}</p>\`;
                    }
                }
            });
            
            // 处理最后的列表
            if (inList && listItems.length > 0) {
                html += '<ul>' + listItems.join('') + '</ul>';
            }
            
            return html;
        }
        
        function showTypingIndicator() {
            const indicator = document.createElement('div');
            indicator.className = 'typing-indicator';
            indicator.id = 'typingIndicator';
            indicator.innerHTML = '<span></span><span></span><span></span>';
            return indicator;
        }
        
        async function sendMessage() {
            if (isProcessing) return;
            
            const question = document.getElementById('questionInput').value.trim();
            if (!question) return;
            
            const visaType = document.getElementById('visa-type').value;
            const country = document.getElementById('country').value;
            const location = document.getElementById('location').value;
            const applicantStatus = document.getElementById('applicant-status').value;
            const useRag = true;
            
            isProcessing = true;
            document.getElementById('sendButton').disabled = true;
            
            // 清空输入框
            document.getElementById('questionInput').value = '';
            textarea.style.height = 'auto';
            
            // 添加用户消息
            const userContent = addMessage('user', '');
            userContent.innerHTML = formatContent(question);
            
            // 添加AI消息容器
            const aiContent = addMessage('assistant', '');
            aiContent.appendChild(showTypingIndicator());
            
            // 滚动到底部
            const chatContainer = document.getElementById('chatContainer');
            chatContainer.scrollTop = chatContainer.scrollHeight;
            
            try {
                const response = await fetch('/api/ask-stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        question,
                        visa_type: visaType,
                        country: country,
                        applicant_location: location,
                        applicant_status: applicantStatus,
                        use_rag: useRag
                    })
                });
                
                if (!response.ok) {
                    throw new Error('网络请求失败');
                }

                // 移除打字指示器
                const typingIndicator = document.getElementById('typingIndicator');
                if (typingIndicator) {
                    typingIndicator.remove();
                }

                // 创建文本容器
                const textContainer = document.createElement('div');
                textContainer.className = 'stream-text typing';
                aiContent.appendChild(textContainer);

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullText = '';  // 累积所有文本
                
                while (true) {
                    const {value, done} = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value, {stream: true});
                    buffer += chunk;
                    
                    // 处理缓冲区中的文本
                    const parts = buffer.split('');
                    for (const char of parts) {
                        fullText += char;  // 累加字符
                        textContainer.innerHTML = formatContent(fullText);
                        chatContainer.scrollTop = chatContainer.scrollHeight;
                        // 控制打字速度
                        await new Promise(resolve => setTimeout(resolve, 20));
                    }
                    buffer = '';  // 清空缓冲区
                }
                
                // 移除打字机效果类
                textContainer.classList.remove('typing');
                
            } catch (error) {
                console.error('Error:', error);
                aiContent.innerHTML = '<div class="error-message">抱歉，服务器出现错误，请稍后再试。</div>';
            } finally {
                isProcessing = false;
                document.getElementById('sendButton').disabled = false;
                document.getElementById('questionInput').focus();
            }
        }
        
        // 页面加载完成后聚焦输入框
        window.onload = function() {
            document.getElementById('questionInput').focus();
        };
    </script>
</body>
</html>`
      }} 
    />
  )
}
