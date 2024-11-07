const express = require('express');
const fs = require('fs');
const cors = require('cors');
const axios = require("axios");
const moment = require("moment/moment");
const app = express();
const dbConnection = require('./db/db');
const scanIP = require('./scripts/find_device_id');

// 使用 cors 中间件
app.use(cors());
app.use(express.json());

app.use(express.static('dist'));

app.get('/', (req, res) => {
    res.sendFile('/index.html');
});





//机台名称反查IP 接口
// app.post('/searchIP', async (req, res) => {
//     try {
//         const selectValues = [`${req.body.deviceName}-%`];
//         const selectSql = `SELECT * FROM deviceIP WHERE device_id LIKE ?`;
//         dbConnection.queryData(selectSql, selectValues, (err, results) => {
//             if (err) {
//                 console.error('Error querying data:', err);
//                 res.status(500).json({error: 'Internal Server Error'});
//             } else {
//                 console.log(results);
//                 res.json(results);
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching printer info:', error);
//         res.status(500).json({error: 'Internal Server Error'});
//     }
//
// });
//
// //查询所有IP
// app.post('/searchAllIP', async (req, res) => {
//     try {
//         const selectValues = ['A%', 'B%', 'C%', 'D%', 'E%', 'F%'];
//         const querySql = `select * from deviceIP where device_id like? order by device_id ASC`;
//
//         const allResults = {};
//
//         const promises = [];
//
//         for (const value of selectValues) {
//             const promise = new Promise((resolve, reject) => {
//                 dbConnection.queryData(querySql, value, (err, results) => {
//                     if (err) {
//                         reject(err);
//                     } else {
//                         // 根据 value 的首字母添加到对应的键名下
//                         const key = `row${value[0].toUpperCase()}`;
//                         allResults[key] = results;
//                         resolve(results);
//                     }
//                 });
//             });
//             promises.push(promise);
//         }
//
//         return Promise.all(promises)
//             .then(() => {
//                 const jsonData = JSON.stringify(allResults, null, 2);
//                 res.json(allResults);
//
//                 return allResults;
//             })
//             .catch(err => {
//                 console.error('Error querying data:', err);
//                 return null;
//             });
//     } catch (error) {
//         console.error('Error fetching printer info:', error);
//         res.status(500).json({error: 'Internal Server Error'});
//     }
//
// });


app.post('/scanIP', async (req, res) => {
    try {
        scanIP.myfunc();
        res.json({message: 'IP scanning started'});

    } catch (error) {
        console.error('Error fetching printer info:', error);
        res.status(500).json({error: 'Internal Server Error'});
    }

});

//查询所有IP
app.post('/searchAllIP2', async (req, res) => {
    try {
        const filePath = './data.json';
        const values = ['A', 'B', 'C', 'D', 'E', 'F'];
        let jsonData = {};

        if (fs.existsSync(filePath)) {
            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    console.error('Error reading file:', err);
                    return;
                }
                const data1 = JSON.parse(data);
                // console.log('aaa',data1);
                for (const value of values) {
                    let results = [];
                    for (let i = 0; i < data1.length; i++) {
                        if (data1[i].device_id.startsWith(value)) {
                            results.push(data1[i]);
                        }
                    }
                    const key = `row${value.toUpperCase()}`;
                    jsonData[key] = results;
                }

                // console.log(jsonData);
                res.json(jsonData);

            });
        } else {
            console.log('File does not exist.');
            fs.writeFileSync(filePath, JSON.stringify([], null, 2));
            res.status(500).json({error: 'data not found'});

        }

    } catch (error) {
        console.error('Error fetching printer info:', error);
        res.status(500).json({error: 'Internal Server Error'});
    }

});


const port = 3333;
const server = app.listen(port, () => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let localAddress = '';
    let networkAddress = '';

    //百度搜的
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const interface of interfaces) {
            if (interface.family === 'IPv4' && !interface.internal) {
                networkAddress = `http://${interface.address}:${port}`;
            }
            if (interface.family === 'IPv4' && interface.internal) {
                localAddress = `http://${interface.address}:${port}`;
            }
        }
    }

    console.log(`  ➜  Local:   ${localAddress}`);
    console.log(`  ➜  Network: ${networkAddress}`);
});
