/**
 *  This is a utility object for universal oauth
 *  signing as well as querying Flickr once a query
 *  object has been constructed to set to the Flickr
 *  API endpoint.
 *
 *  Response are in JSON format.
 */
module.exports = (function() {
  "use strict";
  var crypto = require("crypto"),
      fs = require("fs"),
      request = require("request");

  /**
   * Pretty-print JSON files, because we will want
   * to inspect them manually, as good humans.
   */
  module.exports = (function() {
    if (!JSON.prettyprint) {
      JSON.prettyprint = function prettyprint(data) {
        return this.stringify(data, undefined, 2);
      };
    }
    return JSON;
  }());

  return {

    /**
     * shorthand function
     */
    mkdir: function(dir) {
      var trymkdir = function(dir) {
        try {
          fs.mkdirSync(dir);
          //console.log("creating " + dir);
        }
        catch (e) {
          /* we really don't care if it already exists */
        }
      };
      var f = "";
      dir.replace("./",'').split("/").forEach(function(d) {
        f += d + "/";
        trymkdir(f);
      });
      return dir;
    },

    /**
     * Update an options object for use with Flickr oauth
     * so that it has a new timestampe and nonce.
     */
    setAuthVals: function(options) {
      var timestamp = "" + Date.now(),
          md5 = crypto.createHash('md5').update(timestamp).digest("hex"),
          nonce = md5.substring(0,32);
      options.oauth_timestamp = timestamp;
      options.oauth_nonce = nonce;
      return options;
    },

    /**
     * Collapse a number of oauth query arguments into an
     * alphabetically sorted, URI-safe concatenated string.
     */
    formQueryString: function(queryArguments) {
      var args = [],
          append = function(key) {
            args.push(key + "=" + queryArguments[key]);
          }
      Object.keys(queryArguments).sort().forEach(append);
      return args.join("&");
    },

    /**
     * Turn a url + query string into a Flickr API "base string".
     */
    formBaseString: function(url, queryString) {
      return ["GET", encodeURIComponent(url), encodeURIComponent(queryString)].join("&");
    },

    /**
     * Parse a Flickr API response.
     */
    parseRestResponse: function(body) {
      var constituents = body.split("&"),
          response = {},
          keyval;
      constituents.forEach(function(pair) {
        keyval = pair.split("=");
        response[keyval[0]] = keyval[1];
      })
      return response;
    },

    /**
     * HMAC-SHA1 data signing
     */
    sign: function(data, key, secret) {
      var hmacKey = key + "&" + (secret ? secret : ''),
          hmac = crypto.createHmac("SHA1", hmacKey);
      hmac.update(data);
      var digest = hmac.digest("base64");
      return encodeURIComponent(digest);
    },

    /**
     * Call the Flickr API
     */
    queryFlickr: function(queryArguments, flickrOptions, processResult, errors) {
      // set essential values
      queryArguments.format = "json";
      queryArguments.api_key = flickrOptions.key;
      queryArguments.oauth_signature_method = "HMAC-SHA1";

      // set call-specific values
      flickrOptions = this.setAuthVals(flickrOptions);
      queryArguments.oauth_nonce = flickrOptions.oauth_nonce;
      queryArguments.oauth_timestamp = flickrOptions.oauth_timestamp;

      var url = "http://ycpi.api.flickr.com/services/rest/",
          queryString = this.formQueryString(queryArguments),
          data = this.formBaseString(url, queryString),
          signature = this.sign(data, flickrOptions.secret, flickrOptions.access_token_secret),
          flickrURL = url + "?" + queryString + "&oauth_signature=" + signature;

      request.get(flickrURL, function(error, response, body) {
        // we can transform the error into something more
        // indicative if "errors" is an array of known errors
        // for this specific method call.
        if(!error) {
          try {

            body = body.replace(/^jsonFlickrApi\(/,'').replace(/\}\)$/,'}');
            body = JSON.parse(body);
            if(body.stat !== "ok") {
              return processResult(new Error(body.message));
            }
          } catch (e) {
            console.error("could not parse body as JSON: ", body);
            return processResult(new Error("could not parse body as JSON"));
          }
        }

        processResult(error, body);
      });
    },
  };
}());
