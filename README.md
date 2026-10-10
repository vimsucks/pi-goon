# pi-goon

通过 `/goon` 继续当前 Pi 会话，不向模型发送新的继续提示词。

## 安装

要求 Pi 1.0.0 或更新版本。

```sh
pi install git:github.com/vimsucks/pi-goon
```

安装后，在当前会话执行 `/reload`，或重新启动 Pi。

## 使用

- `/goon`：启动隐形继续。若当前正在生成，Pi 将继续请求加入原生 follow-up 队列。
- `/goon status`：显示会话是否空闲，以及最后一条 assistant 消息的文本。
- `/goon help`：显示命令帮助。

网络请求失败或取消生成后，只要会话仍然存在，就可以执行 `/goon`。如果 Pi 已经退出，先恢复原会话，再执行 `/goon`。

## 工作方式与限制

扩展通过 `pi.sendMessage()` 添加一条隐藏标记，并启动原生会话轮次。`context` 事件处理器在模型请求发出前移除该标记。模型不会收到新的 `go on` 提示词，界面也不会显示该标记，但会话文件仍保留隐藏记录。

存在标记时，处理器还会移除末尾失败或取消的 assistant 消息。它保留带工具调用的消息，防止破坏工具调用与结果的配对。处理器不改写会话历史。

扩展不会自动恢复，不提供快捷键，也不保证从中断的某个字精确接续。它保留 Pi 原生队列、重试和压缩行为。

## 验证

使用 Node.js 24 或更新版本运行无网络检查：

```sh
npm test
```

## 来源与许可

本项目基于 [monotykamary/pi-invisible-continue](https://github.com/monotykamary/pi-invisible-continue) 的 npm 版本 `0.3.16`。原作者为 Tom X Nguyen，原包声明 MIT 许可。本项目保留其隐形继续与消息过滤逻辑，将命令改为 `/goon`，并使用独立的 `pi-goon:resume` 标记。

许可见 [LICENSE](LICENSE)。
