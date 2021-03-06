var Model = function () {

	this.getDataOnline = function(input) {
	// Get data and transform
		result = false;
		$.ajax({
			async: false,
			crossDomain: true,
			url: input
		})
			.done(function (data){
				if (!data) {
					log('getData error failed but completed, data = null: ' + url);
				} else {
					log(data);
					if (typeof data === "object" && data !== null) {
						log('object returned');
						result = data;
					} else {
						log('JSON returned');
						try {
							result = $.parseJSON(data);
						} catch (err) {
							log('getData Json parse error: ' + err);
							result = false;
						}
					}
				}
			})
			.error(function (request, status, error){
				log('getData error failed : ' + input + ", " + status + ", " + error);
			});
		return result;
	},


	this.getImage = function(url, callback, output) {
	    var canvas = document.createElement('CANVAS');
	    ctx = canvas.getContext('2d');
	    img = new Image;
	   	img.crossOrigin = 'Anonymous';
	    img.onload = function(){
	        var dataURL;
	        canvas.height = img.height;
	        canvas.width = img.width;
	        ctx.drawImage(img, 0, 0);
	        dataURL = canvas.toDataURL(output);
	        canvas = null;
	        //log(dataURL);
	        callback.call(this, dataURL);
	    };
	    img.src = url;
	},

	//Requirement: questions must be fetched at least once on first boot
	this.getData = function (input, force){
		var auth0_request = (input.indexOf('auth0.com') > -1);
		if (!auth0_request){
		    var ttl = parseInt(this.getLocal('TTL_' + input.trim()));
			log('TTL is ' + ttl + ' for ' + input);
			now = new Date();
			log('(TTL: ' + ttl + ' and now: ' + now.getTime() + ')');
		} else {
			log('auth0 request.');
		}
        if (auth0_request || (!ttl) || (isNaN(ttl)) || ttl <= now.getTime() || (force)){
			log('Auth0 request or TTL expired/not existant. Fetching online..');
			//if it doesnt exist cached or TTL is more than a day old
			var result = this.getDataOnline(input);
			//result = this.convertAPIdata(result);
			if (auth0_request){
				return result;
			} else {
				if (result){
					log('Putting result in cache..');
					// Fill our local database
					this.putLocal(input.trim(), result);
					// Adjust/add the TTL
					//now.setTime(now.getTime() + 1); //one extra day
					this.putLocal('TTL_' + input.trim(), new Date(new Date().getTime() + 24 * 60 * 60 * 1000).getTime());
					log('Put in cache:');
					log(this.getLocal(input.trim()));
					return result;
				} else {
					if (ttl){
						log('No network, but we have a cached version.');
						//Online doesnt work, but we have a local copy!
						return this.getLocal(input.trim());
					} else {
						log('No network and no cached version.. Returning false..');
						//Online doesnt work and we dont have a local copy..
						return false;
					}
				}
			}
		} else {
			log('TTL valid, opening from cache..');
			var local = this.getLocal(input.trim());
			log(local);
			if (local){
				//Safe to use our cached copy
				return local;
			} else {
				//Local db is non existant. Try to fetch online by removing TTL and recursive call.
				log('Local db is empty. Removing TTL and recursively calling myself.');
				this.removeLocal('TTL_' + input.trim());
				return this.getData(input);
			}
		}
	},

	this.getMoreQuestions = function () {
		log('Getting the categories');
		var categories = this.getCategories();
		log(categories);
		var r = false;
		categories.forEach(function (entry){
			//Will be cached automagically.
			log('Getting questions for category ' + entry.id);
			log(entry);
			var re = (app.model.getQuestions(entry.id, true));
			if (re.questions.length > 0){
				r = true;
			}
		});
		return r;
	},

	this.submit = function (url, data) {
		//Handle everything in once
		this.storeSubmit(url, data);
		this.doSubmits();
	}

	this.dosubmit = function(url, data) {
		log('Submitting:');
		log(data);
		if (data){
			$.post( url, JSON.stringify(data), "json")
				.done( function () {
				  	log('submit successful!');
				    log('Submitting our queue..');
				    //if a submit is successful, let it be.
				    app.model.doSubmits();
				})
				.fail( function (){
					log('submit failed for ' + url + '. Adding to local queue.');
					//if a submit failed, re-add it locally
					app.model.storeSubmit(url, data);
				});
		}
	},

	this.doSubmits = function () {
		//This could mean wrong submits if the user cancels/exits during this process. Only for a day, so meh.
		log('Processing submits..');
		var submits = this.getSubmits();
		this.removeLocal('submits'); //only re-add when failed
		submits.forEach( function (entry) {
			app.model.dosubmit(entry.url, entry.data);
		});
	},

	this.storeSubmit = function (url, data){
		log('Storing submit for ' + url);2
		var submits = this.getLocal('submits');
		if (!submits){
			submits = [];
		}
		submits.push([url, data]);
		this.putLocal('submits', submits);
	},

	this.getSubmits = function () {
		var submits = this.getLocal('submits');
		if (!submits){
			submits = [];
		}
		return submits;
	},

    this.deleteProgress = function(){
        var deferration = $.Deferred();
        $.ajax({
            url: this.userURL + 'reset',
            type: 'POST',
            cache: true,
            success: function (data) {
                log('delete result:' +data);
            },
            complete: function (){
                deferration.resolve();
            },
        });
        return deferration;
    },

	this.getQuestions = function(catid, force) {
		//GET secured/category/{id}(/random)
		var r = this.getData(this.categoryURL + catid + '/random/' + '20', force);
		log('getQuestions for category ' + catid);
		log(r);
		return r;
	},

	this.getRandomQuestion = function(catid) {
		//return this.getData(this.categoryURL + catid + '/random');
		log('Fetching random question..');
		var all = this.getQuestions(catid);
		if (all && all.questions && all.questions.length > 0){
			var r = all.questions[Math.floor(Math.random()*all.questions.length)];
			r[0].category = all.categoryname;
			log('Random question;');
			log(r);
		} else {
			log('no random question available');
			log(all);
			r = false;
		}
		return r[0];
	},

	this.getCategories = function() {
		return this.getData(this.categoriesURL);
	},


	this.getProfile = function() {
		var profile = this.getData(this.profileURL);
		this.getImage(profile.picture, function(base64Img){
			profile.picture = base64Img;
			log('Set profile.picture to ' + profile.picture);
		});

		return profile;
	},

	this.getCategoryAnswered = function(catid) {
		return this.getData(this.userURL + catid + '/progress');
		//return this.getQuestions(catid); //everything is removed when it is answered
	},


	this.getRandomQuestions = function(catid, count) {
		//return this.getData(this.categoryURL + catid + '/random/' + count);
		var result = [];
		log('GetRandomQuestions');
		var all = this.getQuestions(catid);
		if (all.questions.length > 0){
			for (i = 0; i < count && i <= all.questions.length; i++) {
				var index = Math.floor(Math.random()*all.questions.length);
				var item = all.questions[index];
				all.questions.splice(index, 1);
				if (item !== "undefined"){
					result.push(item);
				}
			}
		}
		log('random questions:');
		log(result);
		return result;
	},
	
	this.setupURLs = function () {
		this.baseURL = 'http://d00med.net/quackr/';
		this.secURL = this.baseURL + 'secured/';
		this.profileURL = 'https://quackr.auth0.com/api/users/' + localStorage.getItem('userID');

		this.categoriesURL = this.secURL + 'categories';
		this.categoryURL   = this.secURL + 'category/';
		this.questionURL   = this.secURL + 'question/';
		this.userURL 	   = this.secURL + 'user/';

		this.submitURL	   = this.userURL + 'submit';
	},

	this.sendNumbers = function() {
		var solved_arr = this.getLocal('solved');
		log('solved_arr:');
		log(solved_arr);
		var wrong_arr  = this.getLocal('wrong');
		log('wrong_arr:');
		log(wrong_arr);
		if (solved_arr || wrong_arr){
			log('Submitting to server..');
			error = false;
			try {
				data = {};
				// Question ids of wrong answers
				data['wrong'] = [];
				wrong_arr.forEach(function (entry){
					data['wrong'].push(entry);
				});
				// Question ids of correct answers
				data['solved'] = [];
				solved_arr.forEach(function (entry){
					data['solved'].push(entry);
				});
				log('Submitting;');
				log(data);
				this.submit(this.submitURL, data);
				log('Submitted progress. getMoreQuestions!');
				//flush cache, because the server is updated
				this.getMoreQuestions();
			} catch (err) {
				log('Submit failed; ' + err);
				error = true;
			}
			return error;
		} else {
			log('Nothing to submit');
			return true;
		}
	},

	this.removeQuestionFromCache = function (questionid) {
		var all = this.getCategories();
		var done = false;
		new_arr = [];  
		log('removeQuestionFromCache');
		log(all);
		all.forEach(function(cat){
			if (!done){
				var cat_id = cat.id;
				var all_question = app.model.getQuestions(cat_id);
				if (all_question){
					log('all_question.questions:');
					log(all_question.questions);
					all_question.questions.forEach(function(question){
						log('*');
						log(question[0]);
						var question_id = question[0].id;
						log('Is ' + question_id + ' = ' + questionid + ' ?');
						if (question.id !== undefined && question.id != questionid){
							new_arr.push(question[0]);
						} else {
							log('question ' + questionid + ' found!');
							//found the category
							done = true;
						}
					});
					if (done){
						//this is the category you're looking for. Replace cached questions with a version without the question
						log('New cached version:');
						log(new_arr);
						log('Complete version:');
						log(all_question);
						all_question.questions = new_arr;
						app.model.putLocal(this.categoryURL + cat.id, all_question);
					}
				}
			}
		});
		return done;
	},

	this.correct = function (questionid) {
		//remove question from cache
		log('Removing question id ' + questionid + ' from cache.');
		//update numbers
		//http://d00med.net/quackr/secured/user/1/progress
		this.removeQuestionFromCache(questionid);

		var solved_arr = this.getLocal('solved');
		if (solved_arr){
			solved_arr.push(questionid);
			if (this.sendNumbers()){
				log('Numbers submitted. Removing local correct progress');
				this.removeLocal('solved');
			} else {
				log('Number submit failed. Adding to local correct progress');
				this.putLocal('solved', solved_arr);
			}
		} else {
			this.putLocal('solved', [ questionid ]);
		}
	},

	this.incorrect = function (questionid) {
		//update numbers
		//http://d00med.net/quackr/secured/user/1/progress
		log('Incorrect');
		var wrong = this.getLocal('wrong');
		if (wrong){
			wrong.push(questionid);
			if (this.sendNumbers()){
				log('Numbers submitted. Removing local incorrect progress.');
				this.removeLocal('wrong');
			} else {
				log('Number submit failed. Adding to local incorrect progress.');
				this.putLocal('wrong', wrong);
			}
		} else {
			this.putLocal('wrong', [ questionid ]);
		}
	},

	this.removeLocal = function (key) {
		return $.jStorage.deleteKey(key);
	},

	this.getLocal = function (key) {
		return $.jStorage.get(key, false);
	},

	this.putLocal = function (key, value) {
		return $.jStorage.set(key, value);
	},

	this.initialize = function () {
	// Model constructor
		//all online URLs
		this.setupURLs();

		//do we need to work offline?
		this.online = (navigator.onLine);
		log('Network status: ' + this.online);

		//is this our first run?
		if (!this.getLocal('first')){
			//redirect('we_need_internet');
			//TODO: show page until internet connection is reached
			//TODO: fetchFirstLevels(all_categories)
		}
	},

	this.initialize();
};
