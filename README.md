
# 后端

初始化先执行

```
npm install
```
部署

前端vite build后，将dist文件夹放入指定目录
修改node_db.js中app.use(express.static('dist'));路径


启动

```
node ./node_db.js
```