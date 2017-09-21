const _ = require("lodash");
const Promise = require("bluebird");
const Crawler = require("crawler");
const SafeEval = require("safe-eval");
const NodeList = require('./nodelist');

const extract_user_media = function(res) {
  const result = [];

  res.$("script").each(
    function (i, item) {
      const element_text = res.$(item).text();
      if (!element_text.match('window._sharedData'))
        return;

      const context = {window: {}};
      SafeEval(element_text, context);

      const user_data = context.window._sharedData.entry_data.ProfilePage[0].user;
      const user_name = user_data.username;
      const user_media = user_data.media;

      for (e in user_media.nodes) {
        user_media.nodes[e] = NodeList.filter_elem(user_media.nodes[e]);
        user_media.page_info.max_id = user_media.nodes[e].id;
        delete user_media.nodes[e].video_views;
      }

      user_media.page_info.username = user_name;

      result.push(user_media);
    }
  );

  return result;
};

const crawl_url = function (url, data) {
  return new Promise((resolve, reject) => {
    const handler = function (error, res, done) {
      if (error) {
        reject(error);
      }

      const user_media_result = extract_user_media(res);

      const max_id = _(user_media_result)
        .filter((user_media) => user_media.page_info.has_next_page)
        .map((user_media) => user_media.page_info.max_id)
        .head();

      const result = data ? data.concat(user_media_result) : user_media_result;

      done();
      resolve({ result, max_id });
    };

    const c = new Crawler({
      maxConnections : 10,
      callback : handler,
    });
    c.queue(url);
  });
};

const crawl_user_images = function(username) {
  const crawl_next_page = (data) => {
    if (data.max_id)
      return crawl_url('https://www.instagram.com/'+username+'/?max_id='+data.max_id, data.result).then(crawl_next_page);
    else
      return Promise.resolve(data.result);
  };

  return crawl_url('https://www.instagram.com/'+username+'/').then(crawl_next_page);
};

const crawl_user = function(username) {
  const transform_output = (user_media_arr) => {
    const node_as_output = (node) => ({username, id: node.id, url: node.display_src});
    const flatten_data = _.flatMap(user_media_arr, (data) => data.nodes.map(node_as_output));
    return Promise.resolve(flatten_data);
  };

  return crawl_user_images(username).then(transform_output);
};

module.exports = {
  crawl_user : crawl_user,
};
