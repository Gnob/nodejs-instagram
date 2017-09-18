const _ = require("lodash");
const Promise = require("bluebird");
const Crawler = require("crawler");
const SafeEval = require("safe-eval");
const NodeList = require('./nodelist');

const scan_url = function (url, data) {
  const promise = new Promise((resolve, reject) => {
    const handler = function (error, res, done) {
      if (error) {
        reject(error);
      }

      const user_media_result = [];

      res.$("script").each(
        function (i,item) {
          const element_text = res.$(item).text();
          if (!element_text.match('window._sharedData'))
            return;

          const context = { window : { } };
          SafeEval(element_text, context);

          const user_data  = context.window._sharedData.entry_data.ProfilePage[0].user;
          const user_name  = user_data.username;
          const user_media = user_data.media;

          for (e in user_media.nodes) {
            user_media.nodes[e] = NodeList.filter_elem(user_media.nodes[e]);
            user_media.page_info.max_id = user_media.nodes[e].id;
            delete user_media.nodes[e].video_views;
          }

          user_media.page_info.username = user_name;

          user_media_result.push(user_media);
        }
      );

      const max_id_arr = user_media_result.filter((user_media) => user_media.page_info.has_next_page)
        .map((user_media) => {return user_media.page_info.max_id});

      done();

      const result = data ? data.concat(user_media_result) : user_media_result;
      const max_id = max_id_arr[0];

      resolve({ result, max_id });
    };

    const c = new Crawler({
      maxConnections : 10,
      callback : handler,
    });
    c.queue(url);
  });

  return promise;
}

const crawl_user_images = function(username) {
  const promise = scan_url('https://www.instagram.com/'+username+'/');
  const on_result = (data) => {
    const unit = new Promise((resolve) => resolve(data.result));
    if (data.max_id)
      return scan_url('https://www.instagram.com/'+username+'/?max_id='+data.max_id, data.result).then(on_result);
    else
      return unit;
  };

  return promise.then(on_result);
}

const crawl_user = function(username) {
  const transform_output = (user_media_arr) => {
    const node_as_output = (node) => ({username, id: node.id, url: node.display_src});
    const flatten_data = _.flatMap(user_media_arr, (data) => data.nodes.map(node_as_output));
    return new Promise((resolve) => resolve(flatten_data));
  };

  return crawl_user_images(username).then(transform_output);
}

module.exports = {
  scan_url   : scan_url,
  crawl_user : crawl_user,
}
