var solc = require('solc');

// var eth = require('./web3dummy').eth;
var eth = require('./web3relay').eth;
var getIsTemplate = require('./web3relay').getIsTemplate;

var Contract = require('./contracts');
var mongoose = require( 'mongoose' );
var Template     = mongoose.model( 'Template' );
var config = require('./web3relay').config;
var request = require('request');
var web3 = require('./web3relay').web3;
var crypto = require('crypto');
/* 
  TODO: support other languages
*/
module.exports = async function(req, res) {
  console.log(req.body);
  if (!("action" in req.body))
    res.status(400).send();
  if (req.body.action=="compile") {
    compileSolc(req, res);
  } else if (req.body.action=="find") {
      let type = JSON.parse(await getIsTemplate(req.body.addr)).result.type;
      if(type == 'template'){
        let sourceTx = await getSourceTx(req.body.addr);
        let result;
        let input;
        let md5Hash;
        let url;
        if(sourceTx.successful){
            input = web3.toUtf8(await eth.getTransaction(sourceTx.sourceTxlatestRecorder).input);
            md5Hash = input.substring(0,32);
            url = input.substring(32);
            result = await verifyEqual(url,md5Hash);
        }
        Template.findOne({'address':req.body.addr}).exec(function (err,doc) {
            res.write(JSON.stringify({...doc._doc,resource:result.sourceInfo,equal:result.equal}));
            res.end();
        })
      }
      if(type == 'contract'){
          Contract.findContract(req.body.addr,res);
      }
      if(type == 'normal'){
          res.write(JSON.stringify({}));
          res.end();
      }
  }

}


var compileSolc = function(req, res) {

  // get bytecode at address
  var address = req.body.address;
  var version = req.body.version;
  var name = req.body.name;
  var input = req.body.code;
  var optimization = (req.body.optimization) ? true : false;
  var optimise = (optimization) ? 1 : 0;

  var bytecode = eth.getCode(address);
  if (bytecode.substring(0,2)=="0x")
    bytecode = bytecode.substring(2);

  var data = {
    "address": address,
    "creationTransaction": "", // deal with this later
    "compilerVersion": version,
    "optimization": optimization,
    "contractName": name,
    "sourceCode": input
  }

  console.log(version)

  try {
    // latest version doesn't need to be loaded remotely
    if (version == "latest") {
        var output = solc.compile(input, optimise);
        testValidCode(output, data, bytecode, res);
    } else {

      solc.loadRemoteVersion(version, function(err, solcV) {  
        if (err) {
          console.error(err);
          res.write(JSON.stringify({"valid": false}));
          res.end();
        }
        else {
          var output = solcV.compile(input, optimise); 
          testValidCode(output, data, bytecode, res);
        }
      });
    }
    return;
  } catch (e) {
    console.error(e.stack);
  }

}

var testValidCode = function(output, data, bytecode, response) {
  var verifiedContracts = [];
  for (var contractName in output.contracts) {
    // code and ABI that are needed by web3
    console.log(contractName + ': ' + output.contracts[contractName].bytecode);
    verifiedContracts.push({"name": contractName, 
                            "abi": output.contracts[contractName].interface,
                            "bytecode": output.contracts[contractName].bytecode});
  }

  // Remove swarm hash
  var bytecodeClean = bytecode.replace(/a165627a7a72305820.{64}0029$/gi, "");

  var contractName = ':' + data.contractName; // XXX

  // compare to bytecode at address
  if (!output.contracts || !output.contracts[contractName])
    data.valid = false;
  else if (output.contracts[contractName].bytecode.indexOf(bytecodeClean) > -1){
    var contractBytecodeClean = output.contracts[contractName].bytecode.replace(/a165627a7a72305820.{64}0029$/gi, "");
    constructorArgs = contractBytecodeClean.replace(bytecodeClean, "");
    contractBytecodeClean = contractBytecodeClean.replace(constructorArgs, "");

    if (contractBytecodeClean == bytecodeClean) {
      data.valid = true;
      //write to db
      data.abi = output.contracts[contractName].interface;
      data.byteCode = bytecode;
      Contract.addContract(data);
    } else {
      data.valid = false;
    }
  }  else
    data.valid = false;

  data["verifiedContracts"] = verifiedContracts;
  response.write(JSON.stringify(data));
  response.end();
}
var getSourceTx = function (addr) {
    return new Promise((resolve, reject) => {
        request({url:'http://'+config.nodeAddr+':'+config.gethPort,method:'POST', headers: {
                "content-type": "application/json",
            },body:JSON.stringify({"jsonrpc":"2.0","method":"eth_getSourceTx","params":[addr,"latest"],"id":83})},function (error,response,body) {
            if(!error){
                resolve(JSON.parse(body).result);
            }
        })
    })
}

var verifyEqual = function (url,hash) {
    return new Promise((resolve, reject) => {
        request(url,function (error,response,body) {
            if(!error){
                let md5Hahs = crypto.createHash('md5').update(body).digest('hex');
                resolve({equal:hash == md5Hahs,sourceInfo:body});
            }else {
                reject(false);
            }
        })
    })
}