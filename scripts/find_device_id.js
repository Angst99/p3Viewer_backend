const axios = require('axios');
const moment = require('moment');
const fs = require('fs');
const WebSocket = require('ws');
const wss = new WebSocket.Server({port: 8080});

// const dbConnection = require("../db/db");

const filePath = 'data.json';

let jsonData = [];


//全局变量，用于判断是否正在运行，防止重复运行，扫描中不允许重复扫描
let isRunning = false;

const loadJsonData = () => {
    jsonData = [];
    if (!fs.existsSync(filePath)) {
        console.log(`文件${filePath} 不存在`);

        fs.writeFileSync(filePath, JSON.stringify([], null, 2));
        return;
    } else {
        console.log(`文件${filePath} 已经存在`);
    }
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return;
        }
        jsonData = JSON.parse(data);

        // console.log(jsonData);
    });
}

//四舍五入
function roundToOneDecimalPlace(num) {
    const factor = 10.0;
    num *= factor;
    const intNum = Math.round(num);
    return intNum / factor;
}

async function myfunc(milliseconds) {
    if (isRunning) {
        console.log('isRunning');
        return;
    }
    isRunning = true;

    loadJsonData();

    async function queryPrinterStatus(ip) {
        const printer_info_url = 'http://172.20.10.' + ip + ':5000/get_printer_information/';
        const printer_info_response = await axios.get(printer_info_url, {
            timeout: 100
        });

        // 如果返回的数据已经是对象
        if (typeof printer_info_response.data === 'object') {
            const printerInfoRoot = printer_info_response.data;
            if (printerInfoRoot && printerInfoRoot.device_id) {
                const device_id = printerInfoRoot.device_id;
                return {
                    device_id: device_id,
                    ip_addr: printerInfoRoot.ip_addr,
                    software_version: printerInfoRoot.software_version,
                    hardware_version: printerInfoRoot.hardware_version,
                    machine_code: printerInfoRoot.machine_code,
                }
            } else {
                console.error(`${moment().format('YYYY-MM-DD HH:mm:ss')} Invalid data format for status information at IP:`, ip);
                return {ip: `Invalid data format for status information at IP: ${ip}`};
            }
        } else {
            console.error(`${moment().format('YYYY-MM-DD HH:mm:ss')} device_id is not defined for printer at IP: `, ip);
            return {ip: `device_id is not defined for printer at IP: ${ip}`};
        }
    }

    console.log(moment().format('YYYY-MM-DD HH:mm:ss'));


    let map = new Map();
    const ipAxiosError = [];
    const ipTypeError = [];
    let firstProgress = 0;
    let secondProgress = 0;
    let progressStep = 100 / 256;
    for (let ip = 0; ip <= 255; ip++) {
        try {
            const printerInfo = await queryPrinterStatus(ip);
            console.log(`${moment().format('YYYY-MM-DD HH:mm:ss')}: ip :${ip}`);
            // map.set(`${printerInfo.device_id}`, ip);
            map.set(`${Object.values(printerInfo)[0]}`, Object.values(printerInfo)[1]);
        } catch (error) {
            if (error.isAxiosError && error.code === 'ECONNABORTED') {
                ipAxiosError.push(ip);

            } else if (error.name === 'TypeError' && error.message.includes('Invalid URL')) {
                ipTypeError.push(ip);
            } else {
                ipTypeError.push(ip);
            }
            console.log(`${moment().format('YYYY-MM-DD HH:mm:ss')} : Error for ${ip}: ${error.message}`);
        } finally {
            firstProgress += progressStep;
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({firstProgress: firstProgress,
                        secondProgress: 0}));
                }
            });
            console.log(`${moment().format('YYYY-MM-DD HH:mm:ss')}: progress :${firstProgress}`);

        }
    }

    console.log(`AxiosError: ${ipAxiosError}`);
    console.log(`TypeError: ${ipTypeError}`);

    secondProgress = 0;
    progressStep = 100 / ipAxiosError.length;
    for (const ip of ipAxiosError) {
        try {
            const printerInfo = await queryPrinterStatus(ip);
            console.log(`retry: ip :${ip}`);
            map.set(`${Object.values(printerInfo)[0]}`, Object.values(printerInfo)[1]);
            console.log(` retry ${Object.values(printerInfo)[0]}  ${Object.values(printerInfo)[1]}`);

        } catch (error) {
            console.error(`Error ip:${ip}  , error:${error.message}`);
        } finally {
            secondProgress += progressStep;
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({firstProgress:firstProgress,
                        secondProgress: roundToOneDecimalPlace(secondProgress)}));
                }
            });
        }
    }

    let map2 = new Map();

    for (const id of Array.from(map.keys())) {
        // console.log(`device_id: ${id}, ip: ${map.get(id)}`);
        let isFind = false;
        for (let i = 0; i < jsonData.length; i++) {
            if (jsonData[i].IP === map.get(id) && jsonData[i].device_id === id) {
                // console.log('Find: ', jsonData[i]);
                map2.set(`${jsonData[i].device_id}`, jsonData[i].IP);
                isFind = true;
                break;
            } else {
                // console.log('Not Found: ', jsonData[i]);
                isFind = false;
            }
        }

        if (!isFind) {
            map2.set(`${id}`, map.get(id));
        }
    }

    const sortedKeys = Array.from(map2.keys()).sort((a, b) => {
        const [letterA, numberA] = a.split(/(\d+)/);
        const [letterB, numberB] = b.split(/(\d+)/);
        if (letterA !== letterB) {
            return letterA.localeCompare(letterB);
        } else {
            return parseInt(numberA) - parseInt(numberB);
        }
    });
    jsonData = [];

    for (const key of sortedKeys) {
        // console.log(`device_id: ${key}, ip: ${map2.get(key)}`);
        jsonData.push({
            device_id: key,
            IP: map2.get(key),
        });
    }
    const data = JSON.stringify(jsonData, null, 2);
    fs.writeFileSync(filePath, data);

    isRunning = false;


    // dbConnection.execSql(`CREATE TABLE IF NOT EXISTS deviceIP (
    //     id INT AUTO_INCREMENT PRIMARY KEY,
    //     IP VARCHAR(15) NOT NULL,
    //     device_id VARCHAR(10) NOT NULL,
    //     update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`, '', (err, result) => {
    //     if (err) {
    //         console.error(`Error creating table: deviceIP`, err);
    //     } else {
    //         console.log(`deviceIP created or already exists.`);
    //     }
    // });

    // for (const id of sortedKeys) {
    //     console.log(`device_id: ${id}, ip: ${map.get(id)}`);
    //
    //     const selectValues = [map.get(id)];
    //     const selectSql = `select * from deviceIP where IP =?`;
    //
    //     dbConnection.queryData(selectSql, selectValues, (err, result) => {
    //         if (err) {
    //             console.error('Error querying data:', err);
    //         } else {
    //             // console.log('Query result:', result);
    //             if (result.length <= 0) {
    //                 const insertValues = [map.get(id), id];
    //                 const insertSql = `INSERT INTO deviceIP (IP, device_id) VALUES (?,?)`;
    //
    //                 dbConnection.insertData(insertSql, insertValues, (err, insertId) => {
    //                     if (err) {
    //                         console.error('Error inserting data:', err);
    //                     } else {
    //                         console.log('Inserted row with id:', insertId);
    //                     }
    //                 });
    //             } else {
    //                 const updateValues = [id, map.get(id)];
    //                 const updateSql = `update deviceIP set device_id =? where IP=?`;
    //
    //                 dbConnection.updateData(updateSql, updateValues, (err, result) => {
    //                     if (err) {
    //                         console.error('Error updating data:', err);
    //                     } else {
    //                         console.log(`Updated row with IP: ${updateValues[1]} and new device_id: ${updateValues[0]}`);
    //                     }
    //                 });
    //             }
    //         }
    //     });
    //
    //
    // }


}

// function myfunc2() {
//     const selectValues = ['A%', 'B%', 'C%', 'D%', 'E%', 'F%'];
//     const selectSql = `select * from deviceIP where device_id like ? order by device_id ASC`;
//
//     for (const value of selectValues) {
//         dbConnection.queryData(selectSql, value, (err, results) => {
//             if (err) {
//                 console.error('Error querying data:', err);
//             } else {
//                 for (const result of results) {
//                     console.log('Query result:', value, result);
//                 }
//             }
//         });
//     }
// }

// function myfunc3() {
//     const selectValues = ['A%', 'B%', 'C%', 'D%', 'E%', 'F%'];
//     const querySql = `SELECT *, TIMESTAMPDIFF(MINUTE, update_time, NOW()) AS time_since_update FROM deviceIP where device_id like ? order by device_id ASC`;
//     for (const value of selectValues) {
//
//         dbConnection.queryData(querySql, value, (err, results) => {
//             if (err) {
//                 console.error('Error querying data:', err);
//             } else {
//                 for (const result of results) {
//                     console.log(`${result.device_id}:${result.time_since_update}`);
//                 }
//             }
//         });
//     }
// }

// function myfunc4() {
//     const selectValues = ['A%', 'B%', 'C%', 'D%', 'E%', 'F%'];
//     const querySql = `select * from deviceIP where device_id like? order by device_id ASC`;
//
//     const allResults = {};
//
//     const promises = [];
//
//     for (const value of selectValues) {
//         const promise = new Promise((resolve, reject) => {
//             dbConnection.queryData(querySql, value, (err, results) => {
//                 if (err) {
//                     reject(err);
//                 } else {
//                     // 根据 value 的首字母添加到对应的键名下
//                     const key = `row${value[0].toUpperCase()}`;
//                     allResults[key] = results;
//                     resolve(results);
//                 }
//             });
//         });
//         promises.push(promise);
//     }
//
//     return Promise.all(promises)
//         .then(() => {
//             const jsonData = JSON.stringify(allResults, null, 2);
//             console.log(jsonData);
//             fs.writeFileSync('output.json', jsonData);
//             console.log('Data saved to output.json');
//             return allResults;
//         })
//         .catch(err => {
//             console.error('Error querying data:', err);
//             return null;
//         });
// }


// myfunc();//遍历0-255 查找ip 并存入数据库
// myfunc2();//输出每排ip信息
// myfunc3();//查看每排ip的更新时间
// myfunc4();//输出全部到json文件


module.exports = {myfunc};
