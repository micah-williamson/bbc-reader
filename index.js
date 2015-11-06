module.exports = (function() {
   'use strict';

   var request = require('request');
   var xmldom = new require('xmldom');
   var q = require('q');
   var sanitizehtml = require('sanitize-html'); 
   var toMarkdown = require('./markdown');

   return BBCReader;

   function BBCReader() {
      var self = this;

      this.read = read;

      this.DOMParser = new xmldom.DOMParser({
         errorHandler: {
            warning: function() {/* Ignore */},
            error: function() {/* Ignore */}
         }
      });
      this.XMLSerializer = new xmldom.XMLSerializer();

      /* For Clean Text */
      this.cleanTags = [];
      this.cleanAttributes = {};

      /* For Minimal Non-Clean Text */
      this.minimalTags = ['p', 'cite', 'b', 'i', 'em', 'strong', 'a'];
      this.minimalAttributes = false;

      function read(url, cb) {
         var defer = q.defer();

         request(url, function(error, response, body) {
            if(error) {
               return err(error);
            }

            var Article = {
               title: '',
               datetime: '',
               body: {
                  clean: '',
                  minimal: ''
               },
               images: [
               ],
               source: url
            };

            var dom;
            try {
               dom = self.DOMParser.parseFromString(body, 'text/html');
            } catch(e) {}

            if(!dom) {
               return err('wasnt able to read dom');
            }

            var divs = dom.getElementsByTagName('div');
            var body;

            for(var i = 0; i < divs.length; i++) {
               var div = divs[i];
               if(div.getAttribute('class') === 'story-body__inner') {
                  body = div;
                  break;
               }
            }

            if(!body || !body.getElementsByTagName) {
               return err('wasnt able to find dom body');
            }

            var ps = body.getElementsByTagName('p');

            var bodyCleanStrings = [];
            var bodyMinimalStrings = [];
            for(var i = 0; i < ps.length; i++) {
               var p = ps[i];
               var raw = self.XMLSerializer.serializeToString(p);

               bodyCleanStrings.push(sanitizehtml(raw, {
                  allowedTags: self.cleanTags,
                  allowedAttributes: self.cleanAttributes
               }));

               bodyMinimalStrings.push(sanitizehtml(raw, {
                  allowedTags: self.minimalTags,
                  allowedAttributes: self.minimalAttributes
               }));
            }

            var markdown = toMarkdown(body);

            Article.body.clean = bodyCleanStrings.join('\n\n');
            Article.body.markdown = markdown;

            var imgs = body.getElementsByTagName('img');
            for(var i = 0; i < imgs.length; i++) {
               var img = imgs[i];
               var srcFull = img.getAttribute('src').replace('/320/', '/800/');
               var caption = img.getAttribute('alt');
               if(srcFull) {
                  var found = false;
                  for(var k = 0; k < Article.images.length; k++) {
                     if(Article.images[k].full === srcFull) {
                        found = true;
                     }
                  }

                  if(!found) {
                     Article.images.push({
                        full: srcFull,
                        caption: caption
                     });
                  }
               }
            }

            var imgDivs = body.getElementsByTagName('div');
            for(var i = 0; i < imgDivs.length; i++) {
               var imgDiv = imgDivs[i];
               var srcFull = imgDiv.getAttribute('data-src');
               var caption = imgDiv.getAttribute('data-alt');
               if(srcFull) {

                  var found = false;
                  for(var k = 0; k < Article.images.length; k++) {
                     if(Article.images[k].full === srcFull) {
                        found = true;
                     }
                  }

                  if(!found) {
                     Article.images.push({
                        full: srcFull,
                        caption: caption
                     });
                  }
                  
               }
            }

            var h1 = dom.getElementsByTagName('h1');
            var h1Raw = self.XMLSerializer.serializeToString(h1[0]);
            Article.title = sanitizehtml(h1Raw, {
               allowedTags: self.cleanTags,
               allowedAttributes: self.cleanAttributes
            });

            var datetime;
            for(var i = 0; i < divs.length; i++) {
               var div = divs[i];
               if(div.getAttribute('data-seconds')) {
                  datetime = parseInt(div.getAttribute('data-seconds'));
                  break;
               }
            }

            if(!datetime) {
               return err('unable to find datetime');
            }

            
            Article.datetime = new Date(datetime*1000).toISOString().replace('T', ' ').replace('Z', '') + ' GMT+0000';


            if(cb) {
               cb(Article);
            }

            defer.resolve(Article);
         });

         return defer.promise;

         function err(str) {
            console.error('Error from url: ' + url);
            console.error(str);
            defer.resolve(null);

            if(cb) {
               cb(null);
            }

            return false;
         }
      }
   }
})();