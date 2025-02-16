import json
import socket
import os
import sys

if getattr(sys, 'frozen', False):
    # 如果是打包后的可执行文件
    base_path = sys._MEIPASS
else:
    # 如果是直接运行 Python 脚本
    base_path = os.path.dirname(os.path.abspath(__file__))

config_path = os.path.join(base_path, 'config.json')

name = "飞鹰机枪"
steps = [1,4,4]

# 打开JSON文件
with open('config.json', 'r') as file:
    # 读取并解析JSON文件
    config_data = json.load(file)

# 创建一个TCP/IP套接字
client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

# 服务器地址和端口
server_address = (config_data['ip'], config_data['port'])
sid = config_data['sid']

# 连接到服务器
client_socket.connect(server_address)

# 要发送的消息
message = {
    "opt": 5,
    "sid": sid    # 客户端标识
}
print(f'发送消息: {json.dumps(message)}\n')
client_socket.sendall((json.dumps(message) + '\n').encode('utf-8'))

# 接收服务器的响应
response = client_socket.recv(1024).decode()
print(f'收到服务器响应: {response}')

try:
    response_json = json.loads(response)
    if response_json.get('auth'):
        token = response_json.get('token')
        print(f"成功获取令牌: {token}")
        # 这里可以添加使用令牌进行后续操作的代码，例如发送需要令牌认证的请求
        # 示例：发送一个使用令牌的请求
        new_message = {
            "opt": 1,
            "token": token,
            "macro": {"name": name,"steps": steps}
        }
        new_message_str = json.dumps(new_message) + '\n'
        print(f'发送使用令牌的消息: {new_message_str}')
        client_socket.sendall(new_message_str.encode('utf-8'))

    else:
        print("认证失败")
except json.JSONDecodeError:
    print("无法解析服务器响应的 JSON 数据")

# 关闭连接
client_socket.close()