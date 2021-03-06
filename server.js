'use strict';

var fs = require('fs');
var express = require('express');
var app = express();

var mongoose = require('mongoose');
const MONGODB_URI = 'mongodb://'+process.env.USER+':'+process.env.PASS+'@'+process.env.HOST+':'+process.env.DB_PORT+'/'+process.env.DB;
mongoose.connect(MONGODB_URI);
const searchInst = mongoose.model("search", {term: String, when: Date});

var google = require('googleapis');
var giSearch = google.customsearch('v1');
const CX = process.env.SEARCH_ENGINE_ID
const API_KEY = process.env.API_KEY

function saveNewSearch(search, callback) {
  var newSearchInst = new searchInst({
    term: search,
    when: new Date()
  });
  newSearchInst.save((err, res) => {
    if (err) { console.error('mongodb error:', err); callback(err); return; }
    console.log('saved: ', res);
    callback(null, res);
  });
}

function imageSearch(search, startWith, callback) {
  giSearch.cse.list({
    cx: CX,
    q: search,
    auth: API_KEY,
    searchType: "image",
    start: startWith
    
  }, (err, res) => {
    if (err) { console.error("CSE error: \n", err);
              callback(err, null);
              return; }
    callback(err, res.data.items);
  });
}

function newImageSearch(search, startWith, callback) {
  saveNewSearch(search, (err, res) => {
    if (err) { callback(err); return; }
    imageSearch(res.term, startWith, callback);
  });
}

function mapImageArray(imageArray) {
  return imageArray.map(x => {
    return {url: x.link,
            snippet: x.snippet,
            thumbnail: x.thumbnailLink,
            context: x.displayLink
           }
  });
}

function findLatest(callback) {
  searchInst.find({},"term when",{limit: 5},(err,searches) => {
    console.log(searches);
    if (err) { callback(err); return; }
    callback(null, searches.map(search => {
      return {term: search.term, when: search.when};
    }));
  });
}
 
if (!process.env.DISABLE_XORIGIN) {
  app.use(function(req, res, next) {
    var allowedOrigins = ['https://narrow-plane.gomix.me', 'https://www.freecodecamp.com'];
    var origin = req.headers.origin || '*';
    if(!process.env.XORIG_RESTRICT || allowedOrigins.indexOf(origin) > -1){
         console.log(origin);
         res.setHeader('Access-Control-Allow-Origin', origin);
         res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    }
    next();
  });
}

app.use('/public', express.static(process.cwd() + '/public'));

app.route('/_api/package.json')
  .get(function(req, res, next) {
    console.log('requested');
    fs.readFile(__dirname + '/package.json', function(err, data) {
      if(err) return next(err);
      res.type('txt').send(data.toString());
    });
  });


app.route('/api/imagesearch/:search')
  .get((req, res) => {
    var offset = req.query.offset + 1 || 1;
    console.log("Offset: " + offset);
    newImageSearch(req.params.search, offset, (err, results) => {
      if (err) { res.status(500).send(err); return; }
      res.status(200).type('json').send(mapImageArray(results));
    });
});

app.route('/api/latest/imagesearch')
  .get((req, res) => {
    findLatest((err, latest) => {
      if (err) {
        res.status(500).send(err.message || 'SERVER ERROR');
        return;
      }
      res.type('json').send(latest);
    });
});
  
app.route('/')
    .get(function(req, res) {
		 res.sendFile(process.cwd() + '/views/index.html');
    });

// Respond not found to all the wrong routes
app.use(function(req, res, next){
  res.status(404);
  res.type('txt').send('Not found');
});

// Error Middleware
app.use(function(err, req, res, next) {
  if(err) {
    res.status(err.status || 500)
      .type('txt')
      .send(err.message || 'SERVER ERROR');
  }  
});

app.listen(process.env.PORT, function () {
  console.log('Node.js listening ...');
});

