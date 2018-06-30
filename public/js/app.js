(function(config){
  App = {};

  // set config
  App.config = config;

  // local storage
  App.store = {
    get: function (key) {
      const value = window.localStorage.getItem(key);
      return JSON.parse(value);
    },

    set: function (key, value) {
      value = JSON.stringify(value);
      window.localStorage.setItem(key, value);
    }
  };


  App.init = function () {
    $("#newPage").each(App.newPage);

    $("#showPage").each(App.showPage);

    $("#listPage").each(App.listPage);

  };

  App.newPage = function () {
    console.info('newPage init');

    // init submit button
    $("#submitBtn").click(App.submitContent);
  };

  App.newMoment = function (data) {
    var moment = {
      txid: null,
      time: null,
      text: null,
      img: null,
      ver: App.config.version
    };
    $.extend(moment, data);
    return moment;
  };

  App.storedMoments = function () {
    return App.store.get(App.momentsStoreKey);
  };

  App.resetStoredMoments = function () {
    App.store.set(App.momentsStoreKey, []);
  };

  App.momentsStoreKey = "moments";

  App.hashToTxData = function (hash) {
    var txData = jsonToHex(hash);
    var txData_de = hexToJson(txData);

    console.info(['txData=', hash, txData]);
    console.info(['txData hexToJson:', txData_de]);
    console.info("encode/decode end");

    const hexData = "0x"+txData;
    console.info(['hexData:', hexData]);
    return hexData;
  };

  App.submitContent = function (event) {
    event.preventDefault();

    const contentBody = $("#contentBody").val();

    console.info(['send', contentBody]);

    const chain = App.config.chainUrl;
    const web3 = window.NervosWeb3(chain);


    var content_type = "text";
    var content_body = contentBody;
    console.info(['content_body plan:', content_body]);

    var content_body = baseb64Encode(content_body);
    console.info(['content_body baseb64_encode:', content_body]);
    var content_body_de = baseb64Decode(content_body);
    console.info(['content_body baseb64_decode:', content_body_de]);

    const content_json = {
      content_type: content_type,
      content_body: content_body,
    };

    var newMoment = App.newMoment({
      text: contentBody,
      time: (new Date()).toJSON()
    });

    const hexData = App.hashToTxData(newMoment);

    const privkey = App.config.privkey;
    var nonce = Math.random().toString().slice(2);

    console.info(["nonce", nonce]);

    const tx = {
      to: App.config.sendTo,
      from: App.config.sendFrom,
      privkey: privkey,
      nonce: nonce,
      quota: App.config.sendQuota,
      data: hexData,
      value: App.config.sendValue,
      chainId: App.config.chainId,
      version: 0,
    };

    // sendTransaction
    web3.eth.sendTransaction(tx).then(res => {
     console.log(['sendTransaction', tx, res]);

     setTimeout(function(){
       sendTransactionDone(tx, res, newMoment);
     }, 6000); // TODO: make it quick

    });

    function sendTransactionDone(tx, res, newMoment) {
      const txid = res["result"]["hash"];
      console.log(["sendTransactionDone", "txid:", txid]);

      var moments = App.store.get(App.momentsStoreKey);
      if(!moments) moments = [];
      newMoment.txid = txid; // set txid
      moments.unshift(newMoment); // put latest one at top
      App.store.set(App.momentsStoreKey, moments);

      moments = App.store.get(App.momentsStoreKey);
      console.info(['moments', moments]);

      var url = "$chainBrowserUrl/#/transaction/$txid";
      url = url.replace("$chainBrowserUrl", App.config.chainBrowserUrl);
      url = url.replace("$txid", txid);
      console.info(["url:", url]);

      App.redirectTo("show.html", {txid: txid});
    }

  };

  // redirect to a page with hash params
  // e.g.: App.redirectTo("show.html", {txid: txid});
  App.redirectTo = function (page, params) {
    var path = [page, $.param(params)].join("?");
    window.location.href = path;
  };

  App.showPage = function () {
    var queryParams = $.getQueryParameters();
    console.info(queryParams);

    if(queryParams["txid"]){
      var txid = queryParams["txid"];

      const chain = App.config.chainUrl;
      const web3 = window.NervosWeb3(chain);

      var url = "$chainBrowserUrl/#/transaction/$txid";
      url = url.replace("$chainBrowserUrl", App.config.chainBrowserUrl);
      url = url.replace("$txid", txid);
      console.info(["url:", url]);

      web3.eth.getTransaction(txid).then(res => {
        console.log(['getTransaction', txid, res])

        // res should be sth like:
        // var res = {
        //   "jsonrpc": "2.0",
        //   "id": 361,
        //   "result": {
        //     "hash": "0x4cb88dfd345c14bd19fee51b49bd8cb...",
        //     "content": "0x0a301864209c0e2a058989898989...",
        //     "blockNumber": "0x6c6",
        //     "blockHash": "0xe9668c05536e746260d6844b57...",
        //     "index": "0x0"
        //   }
        // }

        var content = res["result"]["content"];
        console.info(['content', content]);

        var res = web3.cita.parsers.transactionContentParser(content);
        console.info(['res', res]);
        const uint8 = res["data"]; // Uint8Array(53)

        const hex = bytesToHex(uint8).slice(2);
        console.info(["hex:", hex]);
        const tx_data_de = hexToJson(hex);
        console.info(["tx_data_de:", tx_data_de]);

        var moment = App.newMoment(tx_data_de);
        console.info(['moment', moment]);

        // const content_body = tx_data_de["content_body"];

        // const content_body_de = baseb64Decode(content_body);
        // console.info(['content_body baseb64_decode:', content_body_de]);

        // render result
        var tmpl = $.templates("#showMessageTpl");
        var time = new Date(moment.time);
        var html = tmpl.render({ txid: txid, content: moment.text, time: time });
        $("#showMessage").html(html);
      })
    }
  };

  App.listPage = function () {
    var tmpl = $.templates("#listItemTpl");
    var list = $("#messageList");

    var moments = App.storedMoments();
    if(moments){
      for (var i = 0; i < moments.length; i++) {
        var moment = moments[i];
        console.info(moment);
        var time = new Date(moment.time);
        var newItem = tmpl.render({ txid : moment.txid, text: moment.text, time: time });
        list.append(newItem);
      }
    }
  };

  $(App.init);

})(AppConfig);