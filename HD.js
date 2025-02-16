const net = require('net');
const fs = require('fs');
const path = require('path');

// 配置文件路径
const configPath = path.join(__dirname,  'config.json');
const CLIENT_VERSION = "0.5.0";
let connectionToken = null;

/* 配置文件管理 */
function initConfig() {
    if (!fs.existsSync(configPath))  {
        const initialConfig = {
            ip: "127.0.0.1",
            port: 8080,
            sid: generateSID()
        };
        fs.writeFileSync(configPath,  JSON.stringify(initialConfig,  null, 2));
        return initialConfig;
    }

    const config = JSON.parse(fs.readFileSync(configPath));
    if (!config.sid)  {
        config.sid  = generateSID();
        fs.writeFileSync(configPath,  JSON.stringify(config,  null, 2));
    }
    return config;
}

function generateSID() {
    return [...Array(16)].map(() => Math.random().toString(36)[2]).join('');
}

/* 核心通信模块 */
class GameClient {
    constructor(config) {
        this.config  = config;
        this.socket  = new net.Socket();
        this.buffer  = '';
        this.setupSocket();
    }

    setupSocket() {
        this.socket.on('connect',  () => this.handleConnect());
        this.socket.on('data',  data => this.handleData(data));
        this.socket.on('close',  () => this.handleClose());
        this.socket.on('error',  err => this.handleError(err));
    }

    connect() {
        this.socket.connect(this.config.port,  this.config.ip);
    }

    /* 事件处理 */
    handleConnect() {
        console.log('[STATUS]  Connected to server');
        this.sendStatusCheck();   // 初始握手
        this.startHeartbeat();    // 开始心跳
    }

    handleData(rawData) {
        this.buffer  += rawData.toString();

        // 处理完整JSON消息（假设服务器用换行分隔）
        while (true) {
            const endIndex = this.buffer.indexOf(',\n');
            if (endIndex === -1) break;

            const message = this.buffer.slice(0,  endIndex);
            this.buffer  = this.buffer.slice(endIndex  + 1);

            try {
                this.processMessage(JSON.parse(message));
            } catch (e) {
                console.error('[ERROR]  Invalid JSON:', message);
            }
        }
    }

    /* 消息路由 */
    processMessage(msg) {
        console.log('[DEBUG]  Received:', msg);

        switch (msg.opt)  {
            case 0:  // 服务器状态
                this.handleServerStatus(msg);
                break;
            case 5:  // 认证响应
                this.handleAuthResponse(msg);
                break;
            case 3:  // 配置响应
                if (msg.port)  console.log('[CONFIG]',  msg);
                break;
            default:
                console.warn('[WARN]  Unhandled message type:', msg.opt);
        }
    }

    /* 业务逻辑处理 */
    handleServerStatus(response) {
        switch (response.status)  {
            case 0:
                console.log('[STATUS]  Server ready');
                if (!connectionToken) this.requestToken();
                break;
            case 1:
                console.error('[ERROR]  Version mismatch');
                this.socket.destroy();
                break;
            case 2:
                console.log('[AUTH]  Require authentication');
                this.requestToken();
                break;
        }
    }

    handleAuthResponse(response) {
        if (response.auth)  {
            connectionToken = response.token;
            console.log('[AUTH]  Token acquired');
        } else {
            console.error('[AUTH]  Authentication failed');
            // 此处应添加重试逻辑或用户提示
        }
    }

    /* 主动操作 */
    sendStatusCheck() {
        this.sendMessage({
            opt: 0,
            ver: CLIENT_VERSION
        });
    }

    requestToken() {
        this.sendMessage({
            opt: 5,
            sid: this.config.sid
        });
    }

    sendMessage(data) {
        if (data.opt  > 0 && data.opt  !== 5 && !connectionToken) {
            console.error('[ERROR]  No valid token');
            return;
        }
        this.socket.write(JSON.stringify(data)  + '\n');
    }

    /* 功能封装 */
    activateMacro(macroConfig) {
        this.sendMessage({
            opt: 1,
            token: connectionToken,
            macro: macroConfig
        });
    }

    updateConfig(newConfig) {
        this.sendMessage({
            opt: 4,
            token: connectionToken,
            config: newConfig
        });
    }

    /* 系统控制 */
    startHeartbeat() {
        this.heartbeatTimer  = setInterval(() => {
            this.sendStatusCheck();
        }, 30000);
    }

    handleClose() {
        console.log('[STATUS]  Connection closed');
        clearInterval(this.heartbeatTimer);
        connectionToken = null;
    }

    handleError(err) {
        console.error('[NETWORK  ERROR]', err.message);
    }

    shutdown() {
        this.socket.destroy();
    }
}

/* 启动客户端 */
try {
    const config = initConfig();
    const client = new GameClient(config);
    client.connect();

    // 处理进程退出
    process.on('SIGINT',  () => {
        console.log('\n[STATUS]  Shutting down...');
        client.shutdown();
        process.exit();
    });
} catch (e) {
    console.error('[FATAL]  Startup failed:', e.message);
}