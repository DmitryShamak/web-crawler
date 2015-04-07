var fs = require("fs");
var cheerio = require("cheerio");
var request = require("request");
var mime = require("mime");

var uconcat = require('unique-concat');

var async = require("async");

var argv = require("minimist")(process.argv.slice(2), {
	alias: {
		url: "u",
		levels: "lvl"
	}
});

var totalLinks = [];

if (argv.url && argv.levels) {
	startCrawling(argv.url, argv.levels, function (err, data) {
		process.stdout.clearLine();
		process.stdout.cursorTo(0);

		if (err) {
			return console.log(err);
		}

		saveLinksToFile(data);

		console.log("Look in ./outputFile.js");
	});
}

var getConcat = function (arr) {
	var arr = [].concat.apply([], arr);

	return arr;
};

var getValidOnly = function (arr) {
	var validArr = [];

	arr.forEach(function (item) {
		if(item) {
			validArr.push(item);
		}
	});

	return validArr;
};

var setContentLinks = function (links) {
	links = getValidOnly(links);

	totalLinks = uconcat(totalLinks, links);
};

var crawlLinks = function (urls, currLevel, callback) {
	if (currLevel > 0) {
		--currLevel;
		var promises = [];
		urls.forEach(function (item) {
			promises.push(function (cb) {
				getUrlContent(item, cb);
			});
		});

		async.series(
			promises,
			function (err, results) {
				var links = getConcat(results);

				if (currLevel > 0) {
					return crawlLinks(links, currLevel, callback);
				}

				totalLinks = getConcat(totalLinks);

				saveLinksToFile(totalLinks);

				callback(null, totalLinks);
			}
		);
	}
};

var isUrlAbsolute = function (url) {
	if (url.indexOf("http")+1) {
		return true;
	}

	return false;
};

var getUrlContent = function (url, callback) {
	if (url && isUrlAbsolute(url)) {
		console.log("crawling  %s...", url);
		setContentLinks([url]);
		request.get({
			url: url,
			header: {
				"Content-Type": mime.lookup(url)
			}
		}, function (err, res, body) {
			if (err) {
				console.log(err);
				return callback(err, null);
			}

			var $ = cheerio.load(body);

			var links = [];

			$("a").each(function () {
				links.push($(this).attr("href"));
			});

			callback(null, links);
		});
	} else {
		callback(null, []);
	}
};

var saveLinksToFile = function (result) {
	fs.open("./outputFile.json", "w", function (err, fd) {
		var json = JSON.stringify(result);

		fs.write(fd, json, function (err) {
			fs.close(fd, function () {})

		});
	});
};

var startCrawling = function (url, levels, callback) {
	totalLinks = [];

	crawlLinks([url], levels, callback);
};

module.exports.startCrawling = startCrawling;
