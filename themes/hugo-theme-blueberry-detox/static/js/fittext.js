// fittext.js plugin
          (function($){
            $.fn.fitText = function(kompressor, options){
              var compressor = kompressor || 1,
                  settings = $.extend({
                    'minFontSize' : Number.NEGATIVE_INFINITY,
                    'maxFontSize' : 30
                  }, options);
            
              return this.each(function(){
                var $this = $(this);
                var resizer = function () {
                  $this.css('font-size', Math.max(Math.min($this.width() / (compressor*10), parseFloat(settings.maxFontSize)), parseFloat(settings.minFontSize)));
                };
                resizer();
                $(window).on('resize orientationchange', resizer);
              });
            };
          })( jQuery ); 