var Crawler = require("crawler");
var SafeEval = require("safe-eval");
var NodeList = require('./nodelist');
var Download = require('./download');
var SkipDup = require('./skipdup');

var scan_url = function (url, result_cb, context) {
    var handler = function (error, res, done) {
        if (error) {
            console.log(error);
            return;
        }
        res.$("script").each(
            function (i,item) {
                var element_text = res.$(item).text();
                if (!element_text.match('window._sharedData')) return;

                var context = { window : { } };
                SafeEval(element_text, context);

                var user_data  = context.window._sharedData.entry_data.ProfilePage[0].user;
                var user_name  = user_data.username;
                var user_media = user_data.media;

                for (e in user_media.nodes) {
                    user_media.nodes[e] = NodeList.filter_elem(user_media.nodes[e]);
                    user_media.page_info.max_id = user_media.nodes[e].id;
                    delete user_media.nodes[e].video_views; 
                }

                user_media.page_info.username = user_name;

                result_cb(user_media);
            }
        );
        done();
    }

    var c = new Crawler({
        maxConnections : 10,
        callback : handler,
    });
    c.queue(url);
}

var run_result_callback = function(data,cb) {
    cb(data);
    if (data.page_info.has_next_page) {
        return scan_url(
            'https://www.instagram.com/'+data.page_info.username+'/?max_id='+data.page_info.max_id,
            function (data) {
                run_result_callback(data,cb);
            }
        );
    }
}

var scan_user_page = function(username, result_cb) {
    return scan_url('https://www.instagram.com/'+username+'/', result_cb);
}

var scan_user = function(username,cb) {
    return scan_user_page(
        username,
        function (data) {
            run_result_callback(data,cb);
        }
    );
}

var download_user = function(username,dir,filter) {
    if (!dir)
        dir = './download';

    if (!filter)
        filter = new SkipDup(dir+'/fetched-images.db');

    return scan_user(
        username,
        function(data) {
            for (i in data.nodes) {
                Download.download_image(data.nodes[i].display_src, dir+"/user/"+username, data.nodes[i].id, filter);
            }
        }
    );
}

module.exports = {
    scan_url        : scan_url,
    scan_user_page  : scan_user_page,
    scan_user       : scan_user,
    download_user   : download_user,
}
