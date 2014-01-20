/*!
 * Spinner
 * Requires underscore.js
 * Author: Dine Albrecht (2012) (http://dinealbrecht.net)
 * Date : 22/12/2012
 * @version 0.1
**/
 
;(function( $ ) {
    $.fn.spinner = function ( settings ) {
        var
            options = $.extend( {}, $.fn.spinner.defaults, settings ),
            ready = false,
            // Indicates whether the user is dragging
            dragging = false,
            // Stores the pointer or touch start position to track distance
            pointerStartPosX = 0,
            // Stores the pointer or touch end position to track distance
            pointerEndPosX = 0,
            // Stores distance between start and end positions of pointer / touch for tracking period
            pointerDistance = 0,
            // Starting time of tracking
            monitorStartTime = 0,
            // Tracking duration
            monitorInt = 10,
            // Ticker used to call rendering function
            ticker = 0,
            // Canvas Loader instance --- not used
            spinner,
            // The current frame value of the image slider animation
            currentFrame = 0,
            // Stores all the loaded image objects
            frames = [],
            // The final frame the animation should end up at
            endFrame = 0,
            // keep track of how many images have been loaded (show in progress bar)
            loadedImages = 0,
            // track if the image loading should be active, take effect in the load callback
            loadingActive = false,
            // true if the fading between differenct images is happening at this moment
            fadingBetweenColours = false,
            // set to true once all images of the images used for crossfading are loaded
            finishedLoading = false,
            // stores all images
            imagesContainer,
            // stores currently active colour
            currentColour,
            // current Element
            el;
 
        // comment this in if loader is required
        /*this.each(function () {
            el = $(this);
            $(this).append('<div id="spinner" class="spinner"><span>0%</span></div><ol class="spinnerImages"></ol>');
             
            imagesContainer = $(this).find('.spinnerImages');
             
            return this;
        });*/
 
        /**
        * PRIVATE METHODS
        */
     
        /**
        * on mousedown listeners are being activated to track mouse pointer
        */
        var finishDragging = function() {
            //event.preventDefault();
            dragging = false;
 
            deactivateMouseListeners();
 
            // figue out next lower / higher snapFrame
            // depending on direction (pointerdistance indicates direction)
            if ( options.enableSnapping ) {
                if ( pointerDistance < 0 ) {
                    endFrame = findNextLowerSnapFrame(endFrame);
                } else {
                    endFrame = findNextHigherSnapFrame(endFrame);
                }
            } else {
                //endFrame = findClosestSnapFrame(endFrame);
            }
        };
     
        /**
        * on mousedown listeners are being activated to track mouse pointer
        */
        var activateMouseListeners = function() {
            // TODO - only listen to events on document whilst dragging
            $(document).on("mouseup", finishDragging);
 
            $(document).on("mousemove", function (event){
                event.preventDefault();
                trackPointer(event);
            });
        };
 
        /**
        * on mousedown listeners are being activated to track mouse pointer
        */
        var activateTouchListeners = function() {
 
            $(this).on("touchmove", function (event) {
                event.preventDefault();
                trackPointer(event);
            });
 
            $(this).on("touchend", function (event) {
                event.preventDefault();
                dragging = false;
 
                deactivateTouchListeners();
 
                if ( pointerDistance < 0 ) {
                    endFrame = findNextLowerSnapFrame(endFrame);
                } else {
                    endFrame = findNextHigherSnapFrame(endFrame);
                }
            });
        };
 
        /**
        * this function is called on mouseup and disables the mousemove and mouseup listeners
        * improves performance of the site
        */
        var deactivateMouseListeners = function() {
            $(document).off("mouseup", finishDragging);
            $(document).off("mousemove");
        };
 
        /**
        * this function is called on mouseup and disables the mousemove and mouseup listeners
        * improves performance of the site
        */
        var deactivateTouchListeners = function() {
            $(this).off("touchmove");
            $(this).off("touchend");
        };
 
        /**
        * normalizEndFrame
        */
        var normalizeEndFrame = function(endFrame) {
            return ((endFrame%(options.totalFrames))+options.totalFrames)%options.totalFrames;
        };
 
        /**
        * find closest matching snapFrame
        */
        var findClosestSnapFrame = function(goal) {
            var closest = null;
 
            $.each(options.snapFrames, function(index){
                if (closest === null || Math.abs(this - normalizeEndFrame(goal)) < Math.abs(closest - normalizeEndFrame(goal))) {
                    closest = this;
                }
            });
 
            // check if endpoint is closer to the first snap frame than any other frame
            if (Math.abs(options.snapFrames[0] + options.totalFrames - normalizeEndFrame(goal)) < Math.abs(closest - goal)) {
                closest = options.snapFrames[0];
            }
 
            //console.debug("Math.floor("+goal+"/"+options.totalFrames+") + "+closest+": ", Math.floor(goal/options.totalFrames)*options.totalFrames + closest);
            return closest;
        };
 
        /**
        * find closest lower snapFrame
        */
        var findNextLowerSnapFrame = function(goal) {
            var closest = null;
 
            $.each(options.snapFrames, function(index){
                if (this <= normalizeEndFrame(goal)) {
                    closest = this;
                }
            });
 
            // if we still haven't found a smaller one than the largest one will be the smallest
            if (closest === null) {
                closest = options.snapFrames[options.snapFrames.length-1] - options.totalFrames;
            }
             
            closest = Math.floor(goal / options.totalFrames) * 180 + normalizeEndFrame(closest);
            return closest;
        };
 
        /**
        * find closest higher snapFrame
        */
        var findNextHigherSnapFrame = function(goal) {
            var closest = null;
 
            $.each(options.snapFrames, function(index){
                if (this >= normalizeEndFrame(goal) && closest === null) {
                    closest = normalizeEndFrame(this);
                }
            });
 
            // if we still haven't found a smaller one than the largest one will be the smallest
            if (closest === null) {
                closest = options.snapFrames[0] + options.totalFrames;
            }
             
            closest = Math.floor(goal / options.totalFrames) * 180 + closest;
            return closest;
        };
 
        /**
        * Track pointer position changes and figures out "endFrame"
        */
        var trackPointer = function(event) {
            // If the app is ready and the user is dragging the pointer...
            if (ready && dragging) {
                // Stores the last x or y position of the pointer
                if (options.axis == 'x')
                    pointerEndPosX = getPointerEvent(event).pageX;
                else if (options.axis == 'y')
                    pointerEndPosX = getPointerEvent(event).pageY;
                // Checks if there is enough time past between this and the last time period of tracking
                if( monitorStartTime < new Date().getTime() - monitorInt ) {
                    // Calculate distance between start and end position during the last tracking time period
                    pointerDistance = pointerEndPosX - pointerStartPosX;
 
                    if ( options.speedMultiplier < 1 )
                        pointerDistance *= options.speedMultiplier;
                     
                    // Calculates the endFrame using the distance between the pointer X starting and ending positions and the "speedMultiplier" values
                    if ( options.enable360 ) {
                        endFrame = currentFrame + Math.ceil((options.totalFrames - 1) * options.speedMultiplier * (pointerDistance / $(this).width()));
                    } else {
                        if ( pointerDistance > 0 ) {
                            //console.log( "+++++ endFrame: " + endFrame + " ++++ pointerDistance: " + pointerDistance + " $(this).width() " + el.width() );
                            endFrame = Math.min(currentFrame + Math.ceil((options.totalFrames - 1) * options.speedMultiplier * (pointerDistance / el.width())), options.totalFrames - 1);
                        } else if ( pointerDistance < 0 ) {
                            //console.log( "+++++ endFrame: " + endFrame + " ++++ pointerDistance: " + pointerDistance + " $(this).width() " + el.width() );
                            endFrame = Math.max(currentFrame + Math.floor((options.totalFrames - 1) * options.speedMultiplier * (pointerDistance / el.width())), 1);
                        }
 
                        //console.log( currentFrame + " // " + endFrame );
                    }
 
                    //endFrame = findClosestSnapFrame(currentFrame + Math.ceil((options.totalFrames - 1) * options.speedMultiplier * (pointerDistance / $(this).width())));
                    // Updates the image slider frame animation
                    refresh();
                    // restarts counting the pointer tracking period
                    monitorStartTime = new Date().getTime();
                    // Stores the the pointer X position as the starting position (because we started a new tracking period)
                    if (options.axis == 'x')
                        pointerStartPosX = getPointerEvent(event).pageX;
                    else if (options.axis == 'y')
                        pointerStartPosX = getPointerEvent(event).pageY;
                     
                }
            }
        };
 
        /**
        * Adds the loading Canvas spinner from external plugin
        */
        var addSpinner = function() {
            spinner = new CanvasLoader("spinner");
            spinner.setShape("spiral");
            spinner.setDiameter(90);
            spinner.setDensity(90);
            spinner.setRange(1);
            spinner.setSpeed(4);
            spinner.setColor("#333333");
             
            spinner.show();
             
            $('#spinner').fadeIn(500);
        };
 
        /**
        * Preload a set of images
        */
        /*var preloadImages = function () {
            var i;
 
            for (i = 0; i < options.totalFrames; i++) {
                var tempImage = new Image();
                tempImage.src = ( options.imagePath ) + (i + 1) + options.imageFormat;
                tempImage.onload = function(i) {
                    console.debug( "--- image loaded " + i );
                };
            }
        };*/
 
        /**
        * Creates <li> and loads next image into it.
        * Add load event handler - call the imageLoaded function when finished loaded.
        */
        var loadImage = function(imageIndex) {
            //console.debug('loadImage');
             
            var li = document.createElement("li"),
                imageName = ( options.imagePath ) + ( imageIndex ) + options.imageFormat,
                img1 = $('<img>').load(imageLoaded),
                image = $('<img>').attr('src', imageName).addClass("previous-image").appendTo(li);
 
 
            frames.push(image);
            imagesContainer.append(li);
             
            //src must be set after load event for IE
            img1.attr('src', imageName);
        };
 
        /**
        * image loaded event handler
        */
        var imageLoaded = function() {
            loadedImages++;
             
            //$("#spinner span").text(Math.floor(loadedImages / options.totalFrames * 100) + "%");
             
            $('.meter').find('.indicator').css({'width': (loadedImages / options.totalFrames * 100) + "%"});
 
            if (loadedImages <= 1)
                frames[0].removeClass("previous-image").addClass("current-image");
 
            if (loadedImages == options.totalFrames) {
                frames[0].removeClass("previous-image").addClass("current-image");
                 
                /*$("#spinner").fadeOut("slow", function(){
                    spinner.hide();
                    showThreesixty();
                });*/
                if ( options.spinOnLoad ) {
                    showThreesixty();
                } else {
                    ready = true;
                    options.ready();
                }
 
            }
            //safety check against loadedImages being > totalframes
            else if (loadedImages < options.totalFrames && loadingActive === true) {
                loadImage(loadedImages + 1);
            }
        };
 
        /**
        * loads image and replaces according frame with this image
        * Add load event handler - call the imageNumberLoaded function when finished loaded.
        */
        var loadImageByNumber = function(imagenumber, first) {
            //console.debug('loadImageByNumber');
            //console.debug("frames: ", frames);
 
            var imageName = ( options.imagePath ) + (options.totalFrames - imagenumber) + options.imageFormat,
                image = $('<img>');
             
            //console.debug("loadImageByNumber: ", image);
             
            $(image)
                .load(function() {
                    //callback();
                    imageNumberLoaded(imagenumber, first);
                });
                //.each(function() {
                    //if(this.complete) imageNumberLoaded(options.totalFrames - imagenumber);
                //});
 
            //image src must be added last for IE load
            image = image.attr('src', imageName);
        };
 
        /**
        * image loaded event handler
        */
        var hideColourFaderIfPossible = function() {
            if ( finishedLoading && !fadingBetweenColours ) {
                //console.debug( 'HIDE COLOUR FADER ' + finishedLoading + ' -- ' + fadingBetweenColours);
                $(options.elementID).find(".colour-fader").css('display', 'none');
            }
        };
 
        /**
        * image loaded event handler
        */
        var imageNumberLoaded = function(imagenumber, first) {
            var imgsrc = options.imagePath + (options.totalFrames - imagenumber) + options.imageFormat;
 
            if ( first ) {
 
                var incredibleFinishElem = $(options.elementID),
                    colourFader = incredibleFinishElem.find(".colour-fader"),
                    newImage;
 
                newImage = colourFader.find(".new-image").attr("src", imgsrc).css({
                    'display': 'none'
                });
                 
                colourFader.find(".old-image").css('opacity', '1');
                colourFader.css('display', 'block');
                 
                finishedLoading = false;
                fadingBetweenColours = true;
                 
                incredibleFinishElem.find(".colour-name").fadeOut(150, function() {
                    //console.debug('colour-name ------'+ currentColour);
                    $(this)
                        .text( currentColour )
                        .fadeIn(150);
                });
 
                newImage.fadeIn(300, function() {
                    fadingBetweenColours = false;
                    hideColourFaderIfPossible();
                });
            }
 
            //frames = [];
            if ( loadedImages == options.totalFrames ) {
                loadedImages = 0;
                loadedImages++;
                loadImageByNumber(loadedImages, false);
            } else if ( loadedImages == options.totalFrames-1 && !first ) {
                finishedLoading = true;
                hideColourFaderIfPossible();
                frames[(options.totalFrames - imagenumber - 1)].attr("src", imgsrc);
                loadedImages++;
            } else {
                frames[(options.totalFrames - imagenumber - 1)].attr("src", imgsrc);
                loadedImages++;
                loadImageByNumber(loadedImages, false);
            }
             
        };
 
        /**
        * Displays images spinning 4 times.
        */
        var showThreesixty = function() {
            imagesContainer.fadeIn("slow");
            ready = true;
            endFrame = (options.snapFrames?options.snapFrames[0]:0)  - options.totalFrames*4;
            refresh();
        };
 
        /**
        * Renders the image slider frame animations.
        */
        var render = function () {
            //console.log(currentFrame + " !== " + endFrame);
             
            if(currentFrame !== endFrame) {
                 
                /*
                Calculate easing: 10% of distance between currentFrame and endFrame.
                If distance > 0 => ceil value
                If distance < 0 => floor value
                This makes sure that currentFrame reaches endFrame and we don't end up in infinite loop
                */
                var frameEasing = endFrame < currentFrame ? Math.floor((endFrame - currentFrame) * 0.1) : Math.ceil((endFrame - currentFrame) * 0.1);
                 
                // Hide current Frame
                hidePreviousFrame();
 
                // Increments / decrements the "currentFrame" value by the 10% of the frame distance
                currentFrame += frameEasing;
 
                // Show Current Frame
                showCurrentFrame();
 
                if (options.onChangeCurrentFrame) {
                    options.onChangeCurrentFrame(currentFrame);
                }
 
            } else {
                 
                // If no more rendering required => stop and clear the ticker
                var closestEndFrameObject = _.find(options.snapFrames, function(snapFrame){
                    return snapFrame == normalizeEndFrame(endFrame);
                });
 
                /*if ( closestEndFrameObject ) {
                    if (options.navigation) {
                        closestEndFrameObject.element.addClass("active");
                    }
 
                    if (!dragging && options.copyElement)
                        closestEndFrameObject.copyElement.fadeIn(200);
                }*/
 
                // set current and endFrame to be Normalised
                // makes sure that never running completely out od bound
                currentFrame = endFrame = normalizeEndFrame(endFrame);
 
                if (options.afterSpin) {
                    options.afterSpin(endFrame);
                }
 
                // removing ticker function
                window.clearInterval(ticker);
                ticker = 0;
 
            }
        };
 
        /**
        * Create new setInterval store in ticker
        * FPS set to 60 to allow for smooth rendering
        * too high for old browsers
        */
        var refresh = function() {
            // If ticker not running
            if (ticker === 0) {
                // Create ticker
                ticker = self.setInterval(render, Math.round(1000 / options.FPS));
            }
        };
 
        /**
        * Hides previous frame
        */
        var hidePreviousFrame = function() {
            //frames[getNormalizedCurrentFrame()].removeClass("current-image").addClass("previous-image");
            el.find(".current-image").removeClass("current-image").addClass("previous-image");
        };
 
        /**
        * Displays the current frame
        */
        var showCurrentFrame = function() {
            frames[getNormalizedCurrentFrame()].removeClass("previous-image").addClass("current-image");
        };
 
        /**
        * Returns the currentFrame value translated to a value within the range of 0 and options.totalFrames
        */
        var getNormalizedCurrentFrame = function() {
            var c = -Math.ceil(currentFrame % options.totalFrames);
            if (c < 0) c += (options.totalFrames - 1);
            return c;
        };
 
        /**
        * Return simple event to simplify handling of mouse event and touch event.
        */
        var getPointerEvent = function(event) {
            return event.originalEvent.targetTouches ? event.originalEvent.targetTouches[0] : event;
        };
 
        /**
        * bind load on scroll action
        */
        var testForImagePreload = function (event) {
            //check if the module is near view
            var $window = $(window),
                scrollTop = $window.scrollTop(),
                windowHeight = $window.height(),
                distance = windowHeight,
                elTopValue = el.offset().top;
 
            //if near load all images
            if (elTopValue > scrollTop - distance && elTopValue < scrollTop + distance + windowHeight) {
                //start load
                onScrollAction();
            }
            //else use scroll spy to watch
            else {
                //wait for scroll
                el.scrollspy({
                    min: elTopValue - windowHeight,
                    max: elTopValue + el.height(),
                    onEnter: onScrollAction,
                    onLeave: onScrollAction
                });
            }
        };
 
        /**
        * On scroll action
        */
        var onScrollAction = function(targetEl, scrollPosition) {
            if (loadingActive === false) {
                loadingActive = true;
 
                //load next image, will chain from this point
                loadImage(loadedImages + 1);
            }
        };
 
        /**
        * PUBLIC METHODS
        */
 
        /**
        * initialize
        * add eventlisteners
        */
        this.init = function() {
 
            //sets the active state used in the callback from loadImage
            if (options.preloadOnScrollNear === true) {
                $(window).load(function () {
                    setTimeout(function () {
                        testForImagePreload();
                    }, 0);
                });
            }
            else {
                //load all images
                loadingActive = true;
            }
             
            // loading the first image in the sequence.
            loadImage(1);
 
            // set initialFrame
            currentFrame = options.totalFrames - 1;
 
 
            if (!options.canInteract) {
                return this;
            }
 
            // on mouse down add other mouse event listener
            el.on("mousedown", function (event) {
                event.preventDefault();
                 
                options.beforeSpin(currentFrame);
                 
                if (options.axis == 'x') {
                    pointerStartPosX = getPointerEvent(event).pageX;
                } else if (options.axis == 'y') {
                    pointerStartPosX = getPointerEvent(event).pageY;
                }
                 
                dragging = true;
                 
                if (options.copyElements) {
                    //console.debug("++++++++++ $(options.copyElements) fade", $(options.copyElements));
                    $(options.copyElements).stop().fadeOut(200);
                }
                 
                activateMouseListeners();
 
            });
 
            /**
            * TOUCH EVENT LISTENERS
            */
 
            $(this).on("touchstart", function (event) {
                options.beforeSpin(currentFrame);
                event.preventDefault();
                if (options.axis == 'x') {
                    pointerStartPosX = getPointerEvent(event).pageX;
                } else if (options.axis == 'y') {
                    pointerStartPosX = getPointerEvent(event).pageY;
                }
                dragging = true;
                if (options.copyElements) {
                    $(options.copyElements).stop().fadeOut(200);
                }
                activateTouchListeners();
            });
 
            return this;
        };
 
        /**
        * animates through all images.
        */
        this.initialAnimation = function() {
            //ready = true;
            if ( ready ) {
                endFrame = 1;
                refresh();
            }
        };
 
        /**
        * goToFrame
        * sets endFrame to desired final stoppoint
        * starts animation to endFrame by calling refresh
        */
        this.goToFrame = function(endFrame1) {
            options.beforeSpin(currentFrame);
             
            currentFrame = currentFrame % options.totalFrames;
            endFrame = endFrame1;
 
            // take shortest route to endFrame if 360 enabled
            if ( options.enable360 && options.takeShortestRoute ) {
 
                var difference = endFrame - currentFrame;
 
                // go shortest route to endFrame
                if (Math.abs(difference) > options.totalFrames/2)
                    if ( endFrame > currentFrame )
                        endFrame -= options.totalFrames;
                    else if ( endFrame < currentFrame )
                        endFrame += options.totalFrames;
            }
            refresh();
        };
 
        /**
        * goToFrameWithoutEasing
        * sets currentFrame
        */
        this.goToFrameWithoutEasing = function(currentFrameNew) {
            //options.beforeSpin(currentFrame);
            currentFrame = endFrame = currentFrameNew;
             
            // Hide current Frame
            hidePreviousFrame();
 
            // Show Current Frame
            showCurrentFrame();
        };
 
        /**
        * changeImageSource
        * we're replacing the image sources for all frames
        */
        this.changeImageSource = function(imagePath, colourName) {
            var incredibleFinishElem = $(options.elementID);
 
            incredibleFinishElem.find(".colour-fader .old-image").attr("src", incredibleFinishElem.find(".current-image").attr("src"));
             
            options.imagePath = imagePath;
 
            currentColour = colourName;
 
            loadImageByNumber( currentFrame, true );
        };
 
        // initalize plugin
        return this.init();
    };
 
    $.fn.spinner.defaults = {
        // options: true / false
        // default: true
        // True: preload when scroll spy is < window height * 2
        // False : preload all frames on init calls
        preloadOnScrollNear: true,
        // number to times window height before we class a module as 'near'
        nearDistanceModifier : 2,
        // options: values 1 to ????
        // default: 180
        // set amount of Frames
        totalFrames: 180,
        // options: values 1 to 10
        // default: 10
        // set acceleration
        speedMultiplier: 10,
        // options: true, false
        // default: false
        // enable 360 view
        enable360: false,
        // options: true, false
        // default: true
        // enables snnapping into specified snapspots read from
        // data inside navigation
        enableSnapping: false,
        // options: x, y
        // default: x
        // indicates swipe direction
        axis: 'x',
        // options: true, false
        // default: false
        // indicates whether there will be a 3d spin once everything has loaded
        spinOnLoad: false,
        // options: 1-60
        // default: 60
        // Framerate
        FPS: 60,
        // options: callback function
        // default: empty function
        // this will be called before starting to spin
        ready: function() {},
        // options: callback function
        // default: empty function
        // this will be called once all images have been loaded and the flipbook ready to be used
        beforeSpin: function() {},
        // options: callback function
        // default: empty function
        // this will be called after ending to spin (when endframe is reached)
        afterSpin: function() {},
        // options: true, false
        // default: true
        // when navigating to one snapFrame via 360 degree breakpoint it
        // will take the shortest route which might mean going beyond frame 0
        // or beyond last frame
        takeShortestRoute: false,
        // options: function
        // default: null
        // callback function when changing current frame
        onChangeCurrentFrame: null,
        // options: true, false
        // default: true
        // indicates whether user can interact with flipbook by dragging
        // disable this if flipbook is only used as a replacement for video
        canInteract: true,
        elementID: "#incredible-finish"
    };
})( jQuery );