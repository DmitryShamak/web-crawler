var fs = require("fs");
var cheerio = require("cheerio");
var request = require("request");
var mime = require("mime");

var async = require("async");

var argv = require("minimist")(process.argv.slice(2), {
	alias: {
		url: "u",
		levels: "lvl"
	}
});

var webCrawler = new WebCrawler();

if (argv.url && argv.levels) {
	webCrawler.startCrawling(argv.url, argv.levels);
}

function WebCrawler() {
	var self = this;

	self.targetPath = "192.168.12.41:1505/";

	self.resolvePath = function (url) {
		if(url[0] == "/" || url[0] == "./") {
			url = self.targetPath + url.slice(1);
		}

		return url;
	};

	self.getCrawlerPromises = function (urls, cb) {
		var promises = [];

		if (!urls || !urls.length) return false;

		for (var i = 0; i < urls.length; i++) {
			(function (url) {
				promises.push(function (callback) {
					self.getAllLinksOnPage(url, callback);
				});
			})(urls[i]);
		}

		async.series(
			promises,

			function (err, result) {
				cb(null, result);
			}
		);

		return promises;
	};

	self.getWaterfall = function (url, levels) {
		var waterfall = [
			function (cb) {
				self.getCrawlerPromises([url], function (err, links) {
					cb(err, links, links);
				});
			}
		];

		--levels;

		for (var i = 0; i < levels; i++) {
			waterfall.push(function (allLinks, newLinks, cb) {
				self.getCrawlerPromises(newLinks[0], function (err, links) {
					allLinks.push(links);
					showPending();
					cb(err, allLinks, links);
				});
			});
		}

		return waterfall;
	};

	self.startCrawling = function (url, levels, callback) {
		self.targetPath = url;

		var promises = [];

		if (!callback) callback = function (err, data) {
			process.stdout.clearLine();
			process.stdout.cursorTo(0);
			console.log("Look in outputFile.js");
		};

		waterfall = self.getWaterfall(url, levels);

		async.waterfall(
			waterfall,
			
			function (err, result) {
				fs.open("./outputFile.js", "w", function (err, fd) {
					result = result.toString();

					var forOutput = result;

					while (forOutput.indexOf(",")+1) {
						forOutput = forOutput.replace(",", "\n");
					}

					fs.write(fd, forOutput, function (err) {
						fs.close(fd, function () {
							callback(null, result);
						})
						
					});
				});
			}
		);

	};

	self.getAllLinksOnPage = function (url, callback) {
		async.waterfall([
				function (c) {
					self.getUrlContent(url, c);
				},
				function (content, c) {
					var $ = cheerio.load(content);

					var links = [];

					$("a").each(function () {
						links.push($(this).attr("href"));
					});

					showPending();
					c(null, links);
				}
		], function (err, res) {
			if (err) {
				console.log(err);
				return callback(err, null);
			}
			return callback(null, res)
		});
	};

	self.getUrlContent = function (url, callback) {
		showPending();
		request.get({
			url: self.resolvePath(url),
			header: {
				"Content-Type": mime.lookup(url)
			}
		}, function (err, res, body) {
			if (err) {
				console.log(err);
				return callback(err, null);
			}
			return callback(null, body);
		});
	}
};

var pendingStatus = 0;

function showPending() {
	process.stdout.clearLine();
	process.stdout.cursorTo(0);

	var dots = new Array(++pendingStatus).join(".");

	process.stdout.write("Please wait: " + dots);
}

module.exports = webCrawler;
