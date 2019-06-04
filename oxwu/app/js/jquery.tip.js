(function($) {
/*
	$.fn.createTip = function(tip){
		return this.each(function(){
			//if($(this).attr("tip_id")){
			//	$("#" + $(this).attr("tip_id")).remove();
			//}

			var id = "tip_" + Math.floor(Math.random() * 10000);
			$(this).attr("tip_id", id);

			var $div = $("<div></div>").attr({"id": id, "class": "tip"}).append(
				$("<div></div>").attr("class", "textLayer").html((function(that){
					if(typeof(tip) != "undefined"){
						return tip;
					}

					if(typeof($(that).attr("tip")) != "undefined"){
						return $(that).attr("tip");
					}

					return "";
				})(this))
			).append(
				$("<span></span>").attr("class", "icon_tip")
			).appendTo("body");

			return $(this);
		});
	};
*/
	$.fn.showTip = function(settings){
		settings = $.extend(true, {
			"position": "top",
			"color": "black",
			"duration": "fast",
			"tip": ""
		}, settings);

		return this.each(function(){
			var id = $(this).attr("tip_id"), $div = null;
			if(typeof(id) == "undefined"){
				//create
				id = "tip_" + Math.floor(Math.random() * 10000);
				$(this).attr("tip_id", id);

				$div = $("<div></div>").attr({"id": id, "class": "tip"}).append(
					$("<div></div>").attr("class", "textLayer").append(
						$("<span></span>").attr("class", "text").html(settings.tip)
					).append(
						$("<span></span>").attr("class", "icon_tip")
					)
				);
			}
			else{
				$div = $("#" + id);
				$div.find(".text").html(settings.tip);
			}

/*
			var zIndex = 0;
			$(this).parents().each(function(){
				if($(this).css("zIndex") != "auto"){
					zIndex = $(this).css("zIndex");
					return false;
				}
			});
*/
			$div.addClass(settings.color)/*.css("zIndex", zIndex)*/.appendTo("body");

			if(settings.position == "top"){
				$div.css({
					"top": ($(this).offset().top - $div.outerHeight()) + "px",
					"left": ($(this).offset().left + ($(this).outerWidth() - $div.outerWidth()) / 2) + "px"
				});
			}
			else if(settings.position == "bottom"){
				$div.css({
					"top": ($(this).offset().top + $(this).outerHeight()) + "px",
					"left": ($(this).offset().left + ($(this).outerWidth() - $div.outerWidth()) / 2) + "px"
				});
			}
			else if(settings.position == "right"){
				$div.css({
					"top": ($(this).offset().top + ($(this).outerHeight() - $div.outerHeight()) / 2) + "px",
					"left": ($(this).offset().left + $(this).outerWidth()) + "px"
				});
			}
			else if(settings.position == "left"){
				$div.css({
					"top": ($(this).offset().top + ($(this).outerHeight() - $div.outerHeight()) / 2) + "px",
					"left": ($(this).offset().left - $div.outerWidth()) + "px"
				});
			}

			$div.find("span.icon_tip").addClass("tip_" + settings.position + " " + settings.color);
			$div.hide().fadeIn(settings.duration);

			return $(this);
		});
	};

	$.fn.hideTip = function(){
		return this.each(function(){
			$("#" + $(this).attr("tip_id")).remove();
			$(this).removeAttr("tip_id");

			return $(this);
		});
	};
})(jQuery);
