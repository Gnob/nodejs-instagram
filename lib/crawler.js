
const UserPage = require('./userpage');
const Crawler = require('./promise-crawler');

var method = InstagramCrawler.prototype;

function InstagramCrawler(param) {
    this._dir = (param.dir ? param.dir : './download');
}

method.download_user = function(username) {
    console.log("Crawling: "+username);
    UserPage.download_user(username,this._dir);
}

method.download_users = function(users) {
    var obj = this;
    users.forEach(function(u) { obj.download_user(u); });
}

method.get_image_url = function(username, cb) {
    console.log("Crawling image: "+username);
    UserPage.crawl_image_url(username, cb)
}

method.crawl_user = function(username) {
    console.log("Crawling image: "+username);
    return Crawler.crawl_user(username);
}

module.exports = InstagramCrawler;
