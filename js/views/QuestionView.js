var QuestionView = function (data) {
    //View for the overview screen

    this.initialize = function () {

        var createProgressBar = function() {
            var answered = app.model.getCategoryAnswered(data);
            if (answered){
                var progress = Math.round(answered.sizeFinished / answered.sizeQuestions);
                var gage = new JustGage({
                    id: 'pb_question',
                    value: (progress * 100),
                    min: 0,
                    max: 100,
                    title: '',
                    label: '%',
                    donut: true,
                });
            }
        };

        var retrieveNewQuestions = function(catid){
            shake.stopWatch();
            var message = $('#deviceIsReady');
            message.html("Fetching new question");
            message.css('color', 'red');

            //try retrieving more
            log('Trying to retrieve more questions for the cache..');
            if (app.model.getMoreQuestions()){
                log('Questions fetched! Reloading..');
                redirect('next?id=' + catid);
            } else {
                log('Failed to fetch more questions.. Redirecting to categories overview..');
                setInfoMessage('There are no questions left! Turn on internet access and try this again.');
                redirect('categories');
            }
        };

        var goNextQuestion = function(catid){
            shake.stopWatch();
            var message = $('#deviceIsReady');
            message.html("Fetching new question");
            message.css('color', 'red');
            redirect('next?id=' + catid);
        };

        //We don't want to have to back back back our way out of every single question we answered
        //IT is not at all perfect but the best thing I can find for now
        var backKeyDown = function(){
            redirect('categories');
        };

        // View constructor
        if (app.loggedin == true){
            //Show all categories
            log('Loading questionview... (catid ' + data + ')');
            result = app.model.getRandomQuestion(data);
            if (result){
                log('This will be filled in:');
                log(result);
                result.catid = data;
                render('question', {
                    question: result,
                    //catid: data,
                }).done( function (){
                    log('Rendering done.');
                    shake.startWatch(goNextQuestion, data);
                    createProgressBar();
                    document.addEventListener("backbutton", backKeyDown, true);
                });
            } else {
                log('Random question is NULL. Retrieving new questions for category ' + data);
                retrieveNewQuestions(data);
            }
        } else {
            //Re-render and show login page with login filled in
            setErrorMessage('You are not logged in!');
            log('Not logged in for question!');
            redirect('login');
        }
    }	

    this.initialize();
}
