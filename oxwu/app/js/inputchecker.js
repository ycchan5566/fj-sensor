$(function(){
	$("body").livequery("input[limit], input[range]",
		function(){
			$(this).unbind(".validation");

			$(this).bind("focus.validation", function(event){
				$(this).attr("valued", $(this).val());
				$(this).attr("valuep", $(this).val());
			});

			$(this).bind("keyup.validation", function(event){
				if(typeof($(this).attr("range")) != "undefined"){
					if($(this).attr("validation")){return;}

					if($(this).val() != "" && $(this).attr("valuep") != $(this).val()){

						var range = $(this).triggerHandler("getRange");
						var message = null;

						if(range.min != null && range.max != null){
							message = "此欄位輸入範圍為 $minimum ~ $maximum".replace("$minimum", range.min).replace("$maximum", range.max);
						}
						else if(range.min != null){
							message = "此欄位輸入範圍為大於或等於 $minimum".replace("$minimum", range.min);
						}
						else if(range.max != null){
							message = "此欄位輸入範圍為小於或等於 $maximum".replace("$maximum", range.max);
						}

						var value = Number($(this).val());
						if(isNaN(value)){value = 0;}
						if((range.min != null && value < range.min) || (range.max != null && value > range.max)){
							$(this).showTip({"tip": message, "position": ($(this).attr("tip_position") ? $(this).attr("tip_position") : "right"), "color": "red"}).unbind("blur.validationKeyup").bind("blur.validationKeyup", function(){
								$(this).hideTip();
							});
						}
						else{
							$(this).hideTip();
						}
					}

					$(this).attr("valuep", $(this).val());
				}
			});

			$(this).bind("keypress.validation", function(event){
				if(event.which == 0 || event.which == 8 || event.which == 13){return;}//skip enter(13), backspace(8) and special key link F1..etc

				if($(this).attr("limit") == "int"){
					if(!(/[\d+-]/.test(String.fromCharCode(event.which)))){
						$(this).showTip({"tip": "此欄位限輸入整數", "position": ($(this).attr("tip_position") ? $(this).attr("tip_position") : "right"), "color": "red"}).unbind("blur.validationKeypress").bind("blur.validationKeypress", function(){
							$(this).hideTip();
						}).attr("validation", "failed");
						event.preventDefault();
					}
					else{
						$(this).hideTip().removeAttr("validation");
					}
				}
				else if($(this).attr("limit") == "float"){
					if(!(/[\d+-.Ee]/.test(String.fromCharCode(event.which)))){
						$(this).showTip({"tip": "此欄位限輸入整數或浮點數", "position": ($(this).attr("tip_position") ? $(this).attr("tip_position") : "right"), "color": "red"}).unbind("blur.validationKeypress").bind("blur.validationKeypress", function(){
							$(this).hideTip();
						}).attr("validation", "failed");
						event.preventDefault();
					}
					else{
						$(this).hideTip().removeAttr("validation");
					}
				}
				else if($(this).attr("limit") == "hex"){
					if(!(/[0-9A-Fa-f]/.test(String.fromCharCode(event.which)))){
						$(this).showTip({"tip": "此欄位限輸入16進位數值", "position": ($(this).attr("tip_position") ? $(this).attr("tip_position") : "right"), "color": "red"}).unbind("blur.validationKeypress").bind("blur.validationKeypress", function(){
							$(this).hideTip();
						}).attr("validation", "failed");
						event.preventDefault();
					}
					else{
						$(this).hideTip().removeAttr("validation");
					}
				}
				else if(typeof($(this).attr("limit")) != "undefined"){
					var limit = $(this).attr("limit");
					var from = limit.indexOf("["), to = limit.lastIndexOf("]");

					if(from != -1 && to != -1){
						var regex = new RegExp("[" + $(this).attr("limit").substring(from + 1, to) + "]", "g");

						if(!(regex.test(String.fromCharCode(event.which)))){
							$(this).showTip({"tip": "此欄位不允許輸入此字元", "position": ($(this).attr("tip_position") ? $(this).attr("tip_position") : "right"), "color": "red"}).unbind("blur.validationKeypress").bind("blur.validationKeypress", function(){
								$(this).hideTip();
							}).attr("validation", "failed");
							event.preventDefault();
						}
						else{
							$(this).hideTip().removeAttr("validation");
						}
					}
				}
			});

			$(this).bind("correctRange.validation", function(){
				if($(this).attr("limit") == "int" || $(this).attr("limit") == "float"){
					if($(this).val() == "" || isNaN($(this).val()) || !isFinite($(this).val())){//not number or is infinite
						if(typeof($(this).attr("default")) != "undefined"){
							$(this).val($(this).attr("default"));
						}
						else if(!isNaN($(this).attr("valued"))){
							$(this).val($(this).attr("valued"));
						}
						else{
							$(this).val("0");
						}
					}
					else{//no error, just format the number
						$(this).val(Number($(this).val()));
					}

					//maybe value not match the type
					if($(this).attr("limit") == "int"){
						$(this).val(parseInt($(this).val(), 10));
					}
					else if($(this).attr("limit") == "float"){
						$(this).val(parseFloat($(this).val()));
					}
				}
				else if($(this).attr("limit") == "hex"){
					if(!(/[0-9A-Fa-f]/g.test($(this).val()))){
						$(this).val(typeof($(this).attr("default")) != "undefined" ? $(this).attr("default") : "0");
					}
					else{//no error, just padding zero
						var maxLength = Number($(this).attr("maxlength"));
						if(!isNaN(maxLength)){
							var zeroArray = new Array(maxLength);
							for(var i = 0; i < zeroArray.length; i++){
								zeroArray[i] = "0";
							}
							$(this).val(zeroArray.join("").substring(0, maxLength - $(this).val().length) + $(this).val().toUpperCase());
						}
					}
				}
				else if(typeof($(this).attr("limit")) != "undefined"){
					var limit = $(this).attr("limit");
					var from = limit.indexOf("["), to = limit.lastIndexOf("]");

					if(from != -1 && to != -1){
						var notSign = "^";
						if($(this).attr("limit").charAt(from + 1) == "^"){
							notSign = "";
							from++;
						}

						var regex = new RegExp("[" + notSign + $(this).attr("limit").substring(from + 1, to) + "]", "g");
						var value = $(this).val().replace(regex, "");

						$(this).val(value == "" && typeof($(this).attr("default")) != "undefined" ? $(this).attr("default") : value);
					}
				}
			});

			$(this).bind("getRange.validation", function(){
				if(typeof($(this).attr("range")) != "undefined"){
					var min = null, max = null;
					var splitArray = $(this).attr("range").replace(/ /g, "").split("~");

					if(splitArray.length == 2){
						if(splitArray[0] != "" && !isNaN(min)){
							min = Number(splitArray[0]);
						}
						if(splitArray[1] != "" && !isNaN(max)){
							max = Number(splitArray[1]);
						}

						if(min != null && max != null && min > max){
							var temp = min;
							min = max;
							max = temp;
						}
					}

					return {"min": min, "max": max};
				}
			});

			$(this).bind("correctRange.validation", function(event){
				if(typeof($(this).attr("range")) != "undefined"){
					var range = $(this).triggerHandler("getRange");
					var value = Number($(this).val());
					if(isNaN(value)){value = 0;}

					if(range.min != null && value < range.min){
						$(this).val(range.min);
					}
					else if(range.max != null && value > range.max){
						$(this).val(range.max);
					}
					else{
						//$(this).val(value);
					}
				}
			});

			$(this).bindFirst("blur.validation", function(){
				if($(this).attr("require") == "false" && $(this).val() == ""){return;}

				$(this).triggerHandler("correctRange");
			});
		},
		function(){
			$("#" + $(this).attr("tip_id")).remove();
		}
	);

	$("body").livequery("input[length], textarea[length]",
		function(){
			$(this).unbind(".length");

			$(this).bindFirst("keyup.length", function(){
				if($(this).attr("validation")){return;}

				var length = parseInt($(this).attr("length"), 10);
				if(isNaN(length)){return;}

				if(wordCount($(this).val()) > length){
					$(this).showTip({
						"tip": "此欄位包含過多的字元",
						"position": ($(this).attr("tip_position") ? $(this).attr("tip_position") : "right"),
						"color": "red"
					}).unbind("blur.length").bindFirst("blur.length", function(){
						var length = parseInt($(this).attr("length"), 10);
						if(isNaN(length)){return;}

						$(this).val($(this).val().substr(0, wordCut($(this).val(), parseInt($(this).attr("length"), 10))));
						$(this).hideTip();
					});
				}
				else{
					$(this).hideTip();
				}
			});
		},
		function(){
			$("#" + $(this).attr("tip_id")).remove();
		}
	);
});