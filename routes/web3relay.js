#!/usr/bin/env node

/*
    Endpoint for client to talk to etc node
*/
require('../db');
var fs = require('fs');

var Web3 = require("web3");
var web3;

var BigNumber = require('bignumber.js');
var etherUnits = require(__lib + "etherUnits.js");
var mongoose = require('mongoose');

var getLatestBlocks = require('./index').getLatestBlocks;
var filterBlocks = require('./filters').filterBlocks;
var filterTrace = require('./filters').filterTrace;
var Transaction = mongoose.model('Transaction');
var request = require('request');

/*Start config for node connection and sync*/
var config = {};
//Look for config.json file if not
try {
    var configContents = fs.readFileSync('config.json');
    config = JSON.parse(configContents);
    console.log('CONFIG FOUND: Node:' + config.nodeAddr + ' | Port:' + config.gethPort);
}
catch (error) {
    if (error.code === 'ENOENT') {
        console.log('No config file found. Using default configuration: Node:' + config.nodeAddr + ' | Port:' + config.gethPort);
    }
    else {
        throw error;
        process.exit(1);
    }
}

// set the default NODE address to localhost if it's not provided
if (!('nodeAddr' in config) || !(config.nodeAddr)) {
    config.nodeAddr = 'localhost'; // default
}
// set the default geth port if it's not provided
if (!('gethPort' in config) || (typeof config.gethPort) !== 'number') {
    config.gethPort = 8545; // default
}

//Create Web3 connection
if (typeof web3 !== "undefined") {
    web3 = new Web3(web3.currentProvider);
} else {
    web3 = new Web3(new Web3.providers.HttpProvider('http://'+config.nodeAddr+':'+config.gethPort));
}

if (web3.isConnected())
    console.log("Web3 connection established");
else
    throw "No connection, please specify web3host in conf.json";

if (web3.version.node.split('/')[0].toLowerCase().includes('parity')) {
    // parity extension
    web3 = require("../lib/trace.js")(web3);
}

var newBlocks = web3.eth.filter("latest");
var newTxs = web3.eth.filter("pending");

exports.data = async function (req, res) {
    console.log(req.body)
    if ("tx" in req.body) {
        let latestNumber = await getBlockNumber();
        var txHash = req.body.tx.toLowerCase();
        let isCall,isCreateCon,isCreateTem;
        Transaction.findOne({'hash': txHash}).exec(async function (err, doc) {
            if (!err) {
                if(doc !== null){
                    doc._doc.confirmations = latestNumber-doc._doc.blockNumber;
                    if(doc._doc.to == null){
                        isCall = false;
                        isCreateCon = false;
                        isCreateTem = true;
                    }else {
                        let type = JSON.parse(await getIsTemplate(doc._doc.to)).result.type;
                        isCreateTem = false;
                        switch (type){
                            case 'template':
                                isCreateCon = true;
                                isCall = false;
                                break;
                            case 'contract':
                                isCreateCon = false;
                                isCall = true;
                                break;
                            case 'normal':
                                isCreateCon = false;
                                isCall = false;
                                break;
                        }
                    }
                    res.write(JSON.stringify({tx:doc,isCall,isCreateCon,isCreateTem}));
                    res.end();
                }else {
                    web3.eth.getTransaction(txHash, function(err, tx) {
                        if(err || !tx) {
                            console.error("TxWeb3 error :" + err)
                            if (!tx) {
                                web3.eth.getBlock(txHash, function(err, block) {
                                    if(err || !block) {
                                        console.error("BlockWeb3 error :" + err)
                                        res.write(JSON.stringify({"error": true}));
                                    } else {
                                        console.log("BlockWeb3 found: " + txHash)
                                        res.write(JSON.stringify({"error": true, "isBlock": true}));
                                    }
                                    res.end();
                                });
                            } else {
                                res.write(JSON.stringify({"error": true}));
                                res.end();
                            }
                        } else {
                            var ttx = tx;
                            ttx.value = etherUnits.toEther( new BigNumber(tx.value), "wei");
                            //get timestamp from block
                            var block = web3.eth.getBlock(tx.blockNumber, function(err, block) {
                                if (!err && block)
                                    ttx.timestamp = block.timestamp;
                                ttx.isTrace = (ttx.input != "0x");
                                res.write(JSON.stringify(ttx));
                                res.end();
                            });
                        }
                    });
                }
            } else {
                res.write({});
                res.end();
            }
        })
    } else if ("tx_trace" in req.body) {
        var txHash = req.body.tx_trace.toLowerCase();

        web3.trace.transaction(txHash, function (err, tx) {
            if (err || !tx) {
                console.error("TraceWeb3 error :" + err)
                res.write(JSON.stringify({"error": true}));
            } else {
                res.write(JSON.stringify(filterTrace(tx)));
            }
            res.end();
        });
    } else if ("addr_trace" in req.body) {
        var addr = req.body.addr_trace.toLowerCase();
        // need to filter both to and from
        // from block to end block, paging "toAddress":[addr],
        // start from creation block to speed things up
        // TODO: store creation block
        var filter = {"fromBlock": "0x1d4c00", "toAddress": [addr]};
        web3.trace.filter(filter, function (err, tx) {
            if (err || !tx) {
                console.error("TraceWeb3 error :" + err)
                res.write(JSON.stringify({"error": true}));
            } else {
                res.write(JSON.stringify(filterTrace(tx)));
            }
            res.end();
        })
    } else if ("addr" in req.body) {
        var addr = req.body.addr.toLowerCase();
        var options = req.body.options;

        var addrData = {};

        if (options.indexOf("balance") > -1) {
            try {
                addrData["balance"] = web3.eth.getBalance(addr);
                addrData["balance"] = etherUnits.toEther(addrData["balance"], 'wei');
            } catch (err) {
                console.error("AddrWeb3 error :" + err);
                addrData = {"error": true};
            }
        }
        if (options.indexOf("count") > -1) {
            try {
                addrData["count"] = web3.eth.getTransactionCount(addr);
            } catch (err) {
                console.error("AddrWeb3 error :" + err);
                addrData = {"error": true};
            }
        }
        if (options.indexOf("bytecode") > -1) {
            try {
                addrData["detail"] = JSON.parse(await getIsTemplate(addr)).result;
            } catch (err) {
                console.error("AddrWeb3 error :" + err);
                addrData = {"error": true};
            }
        }

        res.write(JSON.stringify(addrData));
        res.end();


    } else if ("block" in req.body) {
        var blockNumOrHash;
        if (/^(0x)?[0-9a-f]{64}$/i.test(req.body.block.trim())) {
            blockNumOrHash = req.body.block.toLowerCase();
        } else {
            blockNumOrHash = parseInt(req.body.block);
        }

        web3.eth.getBlock(blockNumOrHash, function (err, block) {
            if (err || !block) {
                console.error("BlockWeb3 error :" + err)
                res.write(JSON.stringify({"error": true}));
            } else {
                res.write(JSON.stringify(filterBlocks(block)));
            }
            res.end();
        });

        /*
        / TODO: Refactor, "block" / "uncle" determinations should likely come later
        / Can parse out the request once and then determine the path.
        */
    } else if ("uncle" in req.body) {
        var uncle = req.body.uncle.trim();
        var arr = uncle.split('/');
        var blockNumOrHash; // Ugly, does the same as blockNumOrHash above
        var uncleIdx = parseInt(arr[1]) || 0;

        if (/^(?:0x)?[0-9a-f]{64}$/i.test(arr[0])) {
            blockNumOrHash = arr[0].toLowerCase();
            console.log(blockNumOrHash)
        } else {
            blockNumOrHash = parseInt(arr[0]);
        }

        if (typeof blockNumOrHash == 'undefined') {
            console.error("UncleWeb3 error :" + err);
            res.write(JSON.stringify({"error": true}));
            res.end();
            return;
        }

        web3.eth.getUncle(blockNumOrHash, uncleIdx, function (err, uncle) {
            if (err || !uncle) {
                console.error("UncleWeb3 error :" + err)
                res.write(JSON.stringify({"error": true}));
            } else {
                res.write(JSON.stringify(filterBlocks(uncle)));
            }
            res.end();
        });

    } else if ("action" in req.body) {
        if (req.body.action == 'hashrate') {
            web3.eth.getBlock('latest', function (err, latest) {
                if (err || !latest) {
                    console.error("StatsWeb3 error :" + err);
                    res.write(JSON.stringify({"error": true}));
                    res.end();
                } else {
                    console.log("StatsWeb3: latest block: " + latest.number);
                    var checknum = latest.number - 100;
                    if (checknum < 0)
                        checknum = 0;
                    var nblock = latest.number - checknum;
                    web3.eth.getBlock(checknum, function (err, block) {
                        if (err || !block) {
                            console.error("StatsWeb3 error :" + err);
                            res.write(JSON.stringify({
                                "blockHeight": latest.number,
                                "difficulty": latest.difficulty,
                                "blockTime": 0,
                                "hashrate": 0
                            }));
                        } else {
                            console.log("StatsWeb3: check block: " + block.number);
                            var blocktime = (latest.timestamp - block.timestamp) / nblock;
                            var hashrate = latest.difficulty / blocktime;
                            res.write(JSON.stringify({
                                "blockHeight": latest.number,
                                "difficulty": latest.difficulty,
                                "blockTime": blocktime,
                                "hashrate": hashrate
                            }));
                        }
                        res.end();
                    });
                }
            });
        } else {
            console.error("Invalid Request: " + action)
            res.status(400).send();
        }
    } else {
        console.error("Invalid Request: " + action)
        res.status(400).send();
    }

};

function getBlockNumber() {
    return new Promise((resolve, reject) => {
        web3.eth.getBlockNumber(function (err, block) {
            if (!err) {
                resolve(block);
            }
        })
    })
}
function getIsTemplate(addr){
    return new Promise((resolve,reject)=>{
        request({url:'http://'+config.nodeAddr+':'+config.gethPort,method:'POST', headers: {
                "content-type": "application/json",
            },body:JSON.stringify({"jsonrpc":"2.0","method":"eth_getDetail","params":[addr,"latest"],"id":83})},function (error,response,body) {
            if(!error){
                resolve(body);
            }
        })
    })
}

exports.eth = web3.eth;