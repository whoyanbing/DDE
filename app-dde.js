var express = require('express');
var bodyParser = require('body-parser');
var oracledb = require('oracledb');
var path=require('path');
var fs= require("fs");
var csv = require("fast-csv");
var multer = require('multer');
var mysql = require('mysql');
var csv2 = require('node-csv').createParser();
var upload = multer();
var uploadFolder = './upload/';
var exportFolder = './export/'
const OktaJwtVerifier = require('@okta/jwt-verifier');
var cors = require('cors');
/**
 * validating Okta access tokens
 */

const oktaJwtVerifier = new OktaJwtVerifier({
    issuer: 'https://dev-103239.okta.com/oauth2/default',
    clientId: '0oa157ycneRqCURR8357',
    assertClaims: {
        aud: 'api://default',
    },
});
var app = express();
app.use(express.static('client'));

/**
 * A simple middleware that asserts valid access tokens and sends 401 responses
 * if the token is not present or fails validation.  If the token is valid its
 * contents are attached to req.jwt
 */
function authenticationRequired(req, res, next) {
    console.log('authHeader1', req.headers);
    const authHeader = req.headers.authorization || '';
    console.log('authHeader',authHeader);
    const match = authHeader.match(/Bearer (.+)/);

    if (!match) {
        return res.status(401).end();
    }

    const accessToken = match[1];
    const expectedAudience = 'api://default';

    return oktaJwtVerifier.verifyAccessToken(accessToken, expectedAudience)
        .then((jwt) => {
            req.jwt = jwt;
        next();
    })
    .catch((err) => {
            res.status(401).send(err.message);
    });
}

app.use(bodyParser.urlencoded({ extended: false }));
app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
    res.header("Content-Type", "application/json;charset=utf-8");
    next();
});
var mysql_config={
    //Options
  host:'localhost',
  user:'root',
  password:'111111',
  database:'dde'
};

var connection=mysql.createConnection(mysql_config);

//the config of oracle
// var config={
//     user:'test',
//     password:'123456',　　
//     connectString : "45.76.105.71:1521/xe"
// }
var config={
    user:'admin',
    password:'qazxc',
    connectString : "127.0.0.1:49161/xe"
}
oracledb.autoCommit=true;

function SQLExecute(sql,oracleConfig,res){

    oracledb.getConnection(oracleConfig, function(err, connection) {
        if (err) {
          console.log("Fail to connect oracle:", err);
          res.send(err)
          return;
        }
        connection.execute(sql,function(err, result) {
            if (err) {
                res.send(err)
            } else {
               // console.log(result);
                res.send(result)
            }
        connection.close();
        });
    });

}

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


//create folder for uploading file
var createFolder = function(folder){
    try{
        fs.accessSync(folder);
    }catch(e){
        fs.mkdirSync(folder);
    }
}

var fileName;
createFolder(uploadFolder);

var storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadFolder);
    },
    filename: function (req, file, cb) {
        fileName = Date.now()+'-data.csv';
        cb(null, fileName);
    }
});

var storage2 = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadFolder);
    },
    filename: function (req, file, cb) {
        fileName = Date.now()+'-data.json';
        cb(null, fileName);
    }
});
var upload = multer({ storage: storage });
var upload2 = multer({ storage: storage2 });

app.use('/', express.static(path.join(__dirname, '.', 'client')));


// app.get('/', function (req, res) {
//     res.send('Hello World');
// })

// var router = express.Router();
// // view engine setup
// app.set('views', path.join(__dirname, 'client'));
// app.set('view engine', 'html');
// app.use(express.static('client'));

// router.get('/', function(req, res, next) {
//     res.render('index');
// })



//Getting all the table name: seahorse
app.get('/tableOracle', function(req,res){
    //var sql=`select Table_name from all_tables WHERE owner='SYSTEM' and Workspace_Name='DDE'`;
    var sql=`select Table_name from all_tab_columns where COLUMN_NAME='PUBLICATIONTITLE'`;
    SQLExecute(sql,config,res);
})
//Getting all the table name
app.get('/tableMysql', function(req,res){
    var sql=`show tables from dde`;
    connection.query(sql,function(err,result){
        if(err){
            console.log(err)
            res.send(err)
        } else {
            res.send(result)
        }
    })

})

//get all the records in the table according to the table name
app.get('/tableDetailListOracle' ,function(req, res) {
    //console.log('detail',req.query.tableName);
    var sql=`select * from DDE.`+req.query.tableName;
    //var sql=`select * from DDE.SEAHORSE`;
    SQLExecute(sql,config,res)
})

//get all the records in the table according to the table name
app.get('/tableDetailListMysql', function(req, res) {
    var sql=`select * from `+req.query.tableName;
    connection.query(sql,function(err,result){
        res.send(result)
    })
})

//get all the column name of the table according to the table name
app.get('/tableDetailOracle', function(req, res) {
    var sql=`select COLUMN_NAME from all_tab_cols where table_name='`+req.query.tableName+`'`;
    SQLExecute(sql,config,res);
})
app.get('/tableDetailMysql', function(req, res) {
    var sql=`select column_name from information_schema.columns where table_schema = 'dde' and table_name ='`+req.query.tableName+`'`;
    connection.query(sql,function(err,result){
        if(err){
            res.send(err)
        } else {
            res.send(result)
        }
    })
})

//get all the information of one record according to the value of primary key
app.get('/objectDetailOracle', (req, res) =>{
    var sql=`select * from  DDE.`+req.query.tableName+` where `+req.query.column_name+`='`+req.query.name+`'`;
    console.log(sql)
    SQLExecute(sql,config,res);
})

app.get('/objectDetailMysql', (req, res) =>{
    var sql=`select * from  `+req.query.tableName+` where `+req.query.column_name+`='`+req.query.name+`'`;
    connection.query(sql,function(err,result){
        if(err){
            res.send(err)
        } else {
            res.send(result)
        }
    })

})


//delete the record according to the primary key
app.get('/deleteOracle', function(req, res) {
    var sql = `delete from DDE.`+req.query.tableName+` where `+req.query.column_name+` ='`+req.query.name+`'`;
    //console.log('sql',sql)
    SQLExecute(sql,config,res);
})

app.get('/deleteMysql', function(req, res) {
    var sql = `delete from `+req.query.tableName+` where `+req.query.column_name+` ='`+req.query.name+`'`;
    connection.query(sql,function(err,result){
        res.send(result)
    })
})

//insert one record into the table according to the table name
app.post('/insertOracle', function(req, res) {
    var sql = `insert into DDE.`+req.query.tableName+`(`+req.body.queryName+`) values(`+req.body.queryValue+`)`;
    SQLExecute(sql,config,res);

})
app.post('/insertMysql', function(req, res) {
    var sql = `insert into `+req.query.tableName+`(`+req.body.queryName+`) values(`+req.body.queryValue+`)`;
    connection.query(sql,function(err,result){
        res.send(result)
    })

})
//search the keyword in all columns of table
app.get('/searchOracle', function(req, res){
    var sql = `select * from `+req.query.tableName+` where (`+req.query.column_name+`) like '%`+req.query.searchValue+`%'`;
    SQLExecute(sql,config,res);
})
app.get('/searchMysql', function(req, res){
    var sql = `select * from `+req.query.tableName+` where `+req.query.queryString;
    connection.query(sql,function(err,result){
        if(err){
            res.send(err)
        } else {
            res.send(result)
        }
    })
})
//create the table
app.get('/createTableOracle', function(req, res){
    var sql = `create table `+req.query.tableName+`(`+req.body.column_information+`) `;
    SQLExecute(sql,config,res);
})

//export the chosen record as the csv file
app.post('/exportOracle',function(req,res){
    //if no chosen record, it will export all the record in the table
    if((req.body.querys == '') || (req.body.querys == null)){
        var sql=`select * from DDE.`+req.query.tableName
    } else {
        var sql=`select * from DDE.`+req.query.tableName+` where `+req.body.querys;
    }
    //the path of storing the export file
    var url=exportFolder+req.body.filename;
    //oracle connection
    oracledb.getConnection(config, function(err, connection) {
        if (err) {
          console.log("Fail to connect oracle:", err);
          res.send(err)
          return;
        }

        //oracle sql execution
        connection.execute(sql,function(err, result) {
            if (err) {
                res.send(err)
            } else {
                //write the csv file
                csv.writeToBuffer(result.rows).then(data => (fs.writeFile(url,data.toString(),(err) => {
                    if (err) throw err;
                    //send the file to Angular
                    res.sendFile(path.join(path.join(__dirname,exportFolder)+req.body.filename))
                })));

            }
        connection.close();
        });

    });
})
app.post('/exportMysql',function(req,res){
    //if no chosen record, it will export all the record in the table
    if(req.body.querys==undefined){
        var sql=`select * from `+req.query.tableName
    } else {
        var sql=`select * from `+req.query.tableName+` where `+req.body.querys;
    }

    //the path of storing the export file
    var url=exportFolder+req.body.filename;
    //oracle connection
    connection.query(sql,function(err,result){
        if(err){
            res.send(err)
        } else {
            console.log(result)
            csv.writeToBuffer(result).then(data => (fs.writeFile(url,data.toString(),(err) => {
                if (err) throw err;
                //send the file to Angular
                res.sendFile(path.join(path.join(__dirname,exportFolder)+req.body.filename))
            })));
        }
    })
})

//export the structure of table
app.post('/exportTableOracle', function(req, res) {
    var sql=`select COLUMN_NAME,DATA_TYPE,DATA_LENGTH from user_tab_cols where table_name='`+req.query.tableName+`'`;
    //oracle connection
    oracledb.getConnection(config, function(err, connection) {
        if (err) {
          console.log("Fail to connect oracle:", err);
          res.send(err)
          return;
        }

        //oracle sql execution
        connection.execute(sql,function(err, result) {
            if (err) {
                res.send(err)
            } else {
                //transfer the result to json format
                resultJson=JSON.stringify(result.rows);
                //write the result into json file
                fs.writeFile(exportFolder+'data.json',resultJson,function(err){
                    if (err) {res.status(500).send('Server is error...')}
                    //send the json file to Angular
                    res.sendfile(exportFolder+'data.json')
                })
            }
        connection.close();
        });

    });
})
app.post('/exportTableMysql', function(req, res) {
    var sql=`select column_name,DATA_TYPE,CHARACTER_MAXIMUM_LENGTH from information_schema.columns where table_name='`+req.query.tableName+`' and table_schema='dde'`;
    //oracle connection
    connection.query(sql,function(err,result){
        res.send(result)
    })
})

//import the records into the table
app.post('/importOracle',upload.single('file'),function(req,res){
    //read the content of csv file
    csv2.parseFile(uploadFolder+fileName, function(err, data) {
        //write the sql query without binding
        var sqlQuery = `insert into DDE.`+req.query.tableName+` values(`;
        for (let columnIndex = 1; columnIndex <= data[0].length; columnIndex++) {
            if(columnIndex!=data[0].length){
                sqlQuery = sqlQuery+`:`+columnIndex+`,`;
            } else {
                sqlQuery = sqlQuery+`:`+columnIndex+`)`;
            }
        }
        //oracle connection
        oracledb.getConnection(config, function(err, connection) {
            if (err) {
                console.log("Fail to connect oracle:", err);
                res.send(err)
                return;
            }
            //oracle sql execution
            connection.executeMany(sqlQuery,data,{},function(err, result) {
                if (err) {
                    res.send(err)
                } else {
                    //send the result to Angular
                    res.send(result);
                }
                connection.close();
            });
        });
    });

});
app.post('/importMysql',upload.single('file'),function(req,res){
    //read the content of csv file
    csv2.parseFile(uploadFolder+fileName, function(err, data) {
        //write the sql query without binding
        var column_name =`(`;

        var sqlQuery = `insert into `+req.query.tableName+` values ?`;

        connection.query(sqlQuery,[data],function(err,result){
            if(err){
                console.log(err)
                res.send(err)

            } else {

                res.send(result)
            }
        })
    });

});
//import the table structure
app.post('/importTableOracle',upload2.single('file'),function(req,res){
    var file=uploadFolder+req.file.filename;
    //read the json file and put content into result
    var result=JSON.parse(fs.readFileSync( file));

    //write the sql query
    sql = `create table `+req.query.tableName+`(`;
    for (let columnIndex = 0; columnIndex < result.length; columnIndex++) {
        for (let columnContentIndex = 0; columnContentIndex < result[columnIndex].length; columnContentIndex++) {
            if(columnContentIndex == 0){
                sql = sql+result[columnIndex][columnContentIndex]+` `;
            } else if(columnContentIndex == 1){
                sql = sql+result[columnIndex][columnContentIndex];
            } else {
                if(result[columnIndex][1]!="LONG")
                    sql = sql+`(`+result[columnIndex][columnContentIndex]+`)`
            }

        }
        if(columnIndex!=result.length-1){
            sql = sql+`,`
        } else {
            sql = sql+`)`
        }

    }
    //execute the sql query
    SQLExecute(sql,config,res);
    fs.unlink(uploadFolder+req.file.filename,(err)=>{
        if(!err){
            console.log('successfully')
        }
    })
});
app.post('/importTableMysql',upload2.single('file'),function(req,res){
    var file=uploadFolder+req.file.filename;
    //read the json file and put content into result
    var result=JSON.parse(fs.readFileSync( file));
    console.log(result[0]["COLUMN_NAME"])
    //write the sql query
    sql = `create table `+req.query.tableName+`(`;
    for (let columnIndex = 0; columnIndex < result.length; columnIndex++) {
            if(result[columnIndex]["DATA_TYPE"]!="varchar"){
                sql = sql+result[columnIndex]["COLUMN_NAME"]+` `+result[columnIndex]["DATA_TYPE"];
            }
            else{
                sql = sql+result[columnIndex]["COLUMN_NAME"]+` `+result[columnIndex]["DATA_TYPE"]+`(`+result[columnIndex]["CHARACTER_MAXIMUM_LENGTH"]+`)`;
            }
            if(columnIndex!=result.length-1){
                sql = sql+`,`
            } else {
                sql = sql+`)`
            }

    }
    //execute the sql query
    connection.query(sql,function(err,result){
        if(err){
            console.log(err)
            res.send(err)
        } else {
            res.send(result)
        }
    })
    fs.unlink(uploadFolder+req.file.filename,(err)=>{
        if(!err){
            console.log('successfully')
        }
    })
});

//update the information of record
app.post('/updateOracle', function(req, res) {
    var sql = `update DDE.`+req.query.tableName+` set `+req.body.updateQuery+` where ID ='`+req.query.name+`'`;
    console.log('update',sql);
    SQLExecute(sql,config,res)
})
app.post('/updateMysql', function(req, res) {
    var sql = `update `+req.query.tableName+` set `+req.body.updateQuery+` where `+req.query.column_name+` ='`+req.query.name+`'`;
    connection.query(sql,function(err,result){
        res.send(result)
    })
})

// create connection and the exposed port is http://localhost:8086
var server = app.listen(5000,'0.0.0.0',function () {

    var host = server.address().address
    var port = server.address().port

    console.log("Host address is http://%s:%s", host, port);
});
