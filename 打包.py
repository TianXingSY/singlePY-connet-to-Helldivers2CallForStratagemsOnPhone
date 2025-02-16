import os
import subprocess

# 定义要打包的文件夹路径，可根据实际情况修改
folder_path = './command'

# 遍历文件夹下的所有文件
for root, dirs, files in os.walk(folder_path):
    for file in files:
        if file.endswith('.py'):
            py_file_path = os.path.join(root, file)
            try:
                # 构建 PyInstaller 命令
                command = [
                    'pyinstaller',
                    '--onefile',
                    '--noconsole',
                    py_file_path
                ]
                # 执行命令
                subprocess.run(command, check=True)
                print(f"成功打包 {py_file_path}")
            except subprocess.CalledProcessError as e:
                print(f"打包 {py_file_path} 时出错: {e}")