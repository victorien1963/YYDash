    function() {
      var list = d3.range(20);
      return {
        value: [{name: "Score", data: list.map(function(d,i) { return Math.round(Math.random() * 90 + 10); })}],
        name: [{name: "Name", data: list.map(function(d,i) { return plotdb.data.sample.name.rand(); })}],
        category: [{name: "Dept", data: list.map(function(d,i) { return plotdb.data.sample.category.rand(); })}]
      };
    },
    dimension: {
      value: { type: [plotdb.Number], require: true, desc: "size of the block" },
      name: { type: [], require: false, desc: "name of the block" },
      category: { type: [], require: false, desc: "parent of the block"},
      color: { type: [], require: false, desc: "color of block. leave empty to color by category"}
    },
    config: {
      fontFamily: {},
      background: {},
      textFill: {},
      fontSize: {default: 14},
      stroke: {default: "#000"},
      strokeWidth: {default: 5},
      margin: {},
      palette: {},
      legendLabel: {},
      legendShow: {},
      labelShow: {},
      labelShowThreshold: {
        name: "Only Show labels over this value",
        desc: "this config controls the labels to show by their underlying area",
        default: 10,
        type: [plotdb.Number],
        min: 0, max: 1000,
        category: "Label"
      },
      labelShadowSize: {},
      popupShow: {}
    },
    init: function() {
      var that = this;
      this.svg = d3.select(this.root).append("svg"); 
      this.legendGroup = this.svg.append("g").attr({class: "legend-group"});
      this.tooltip = plotd3.html.tooltip(this.root).on("mousemove", function(d,i,popup) {
        var data = d3.select(that.sites[0][i]).datum();
        popup.select(".title").text(data.name + " / " + data.category);
        popup.select(".value").text(data.data);
      });
      requestAnimationFrame(function() { that.tickWrap(); });
    },
    tickWrap: function() {
      var that = this;
      this.tick();
      requestAnimationFrame(function() { that.tickWrap(); });
    },
    parse: function() {
      this.data.map(function(it) { 
        it.key = it.name;
        it.data = it.value;
      });
      this.total = this.data.reduce(function(a,b) { return a + b.data; }, 0);
      this.categories = d3.map(this.data, function(d,i) { return d.category; }).keys();
      this.parsed = {children: d3.nest().key(function(it) { return it.category; }).entries(this.data).map(function(it) {
        it.children = it.values;
        return it;
      })};
    },
    bind: function() {
      var that = this, sel;
      var sites = this.treemap.getSites();
      sel = this.svg.selectAll("path.data").data(this.treemap.getPolygons());
      sel.exit().remove();
      sel = sel.enter().append("path").attr({"class": "data", opacity: 1});
      this.svg.selectAll("path.data").attr({
        class: function(d,i) {
          return (sites[i].lv <=0 ? "data group" : "data");
        }
      });
      if(this.config.popupShow) this.tooltip.nodes(sel);
      this.polygons = this.svg.selectAll("path.data");
      sel = this.svg.selectAll("g.label").data(sites);
      sel.exit().remove();
      sel = sel.enter().append("g").attr({"class": "label"}).each(function(it) {
        var node = d3.select(this);
        node.append("text").attr({"class": "name shadow"});
        node.append("text").attr({"class": "value shadow"});
        node.append("text").attr({"class": "name"});
        node.append("text").attr({"class": "value"});
      });
      this.sites = this.svg.selectAll("g.label");
      this.sites.each(function(d,i) {
        d3.select(this).selectAll("text").datum(d);
      });
    },
    resize: function() {
      var that = this;
      var box = this.root.getBoundingClientRect();
      var width = this.width = box.width;
      var height = this.height = box.height;
      this.svg.attr({
        width: width + "px", height: height + "px",
        viewBox: [0,0,width,height].join(" "),
        preserveAspectRatio: "xMidYMid"
      });
      this.tooltip.fontSize(this.config.fontSize);
      this.useColor = !!this.dimension.color.fields.length;
      this.cScale = plotdb.Palette.scale.auto(
        this.config.palette,
        this.useColor ? this.dimension.color.fields : this.dimension.category.fields
      );
      this.legend = plotd3.rwd.legend()
        .scale(this.cScale)
        .orient("bottom")
        .tickValues(this.cScale.domain())
        .size([this.width - 2 * this.config.margin, 100])
        .fontSize(this.config.fontSize);
      this.legend.label(this.config.legendLabel || "");
      this.legendGroup.call(this.legend).selectAll(".legend").on("mouseover", function(d,i) {
        var sites = that.treemap.getSites();
        that.activeGroup = d;
        that.polygons.transition().attr({
          opacity: function(d,i) {
            var data = sites[i];
            return (!that.activeGroup || that.activeGroup == data.category ? 1 : 0.1);
          }
        });
      }).on("mouseout", function(d,i) {
        that.activeGroup = null;
        that.polygons.transition().attr({ opacity: 1 });
      });
      this.legendSize = (this.config.legendShow ? this.legend.offset() : [0,0]);
      this.xScale = d3.scale.linear().domain([0,width]).range([
        this.config.margin, 
        width - this.config.margin
      ]);
      this.yScale = d3.scale.linear().domain([0,height]).range([
        this.config.margin, 
        height - this.config.margin - (this.config.legendShow ? this.legendSize[1] + this.config.fontSize : 0)
      ]);
      this.treemap = new Voronoi.Treemap(this.parsed, Voronoi.Polygon.create(width, height, 60), width, height);
    },
    tick: function() {
      this.treemap.compute();
      this.renderTreemap();
    },
    render: function() {
      var that = this;
      if(this.config.fontFamily) d3.select(this.root).style("font-family", this.config.fontFamily);
      d3.select(this.root).style("background-color", this.config.background);
      this.svg.selectAll("text").attr({
        "font-size": that.config.fontSize,
        "fill": that.config.textFill
      });
      this.legendGroup.attr({
        transform: ["translate(", (this.width - this.legendSize[0])/2, (this.height - this.legendSize[1] - this.config.margin), ")"].join(" "),
        display: (this.config.legendShow ? "block" : "none")
      });
      this.sites.attr({
        "font-size": this.config.fontSize,
        "font-weight": "200",
        "text-anchor": "middle",
        dy: "0.38em",
        display: function(d,i) {
          return (that.config.labelShow && (0.001 * that.config.labelShowThreshold < d.data / that.total) ? "block" : "none");
        }
      });
      this.sites.selectAll("text").attr({
        fill: function(it) {
          var hsl = d3.hsl(that.cScale(that.useColor ? it.color : it.category));
          if(hsl.l > 0.65) return "#000";
          return "#fff";
        }
      });
      this.sites.selectAll(".name").attr({
        dy: "-0.5em"
      }).text(function(it) {
        if(it.lv >= 1) return it.name;
        return "";
      });
      this.sites.selectAll(".value").attr({
        dy: "0.5em",
        "font-size": "0.8em"
      }).text(function(it) {
        if(it.lv >= 1) return Math.round(100*it.data)/100;
        return "";
      });
      this.sites.selectAll(".shadow").attr({
        stroke: function(it) {
          var hsl = d3.hsl(that.cScale(that.useColor ? it.color : it.category));
          if(hsl.l > 0.65) return "#fff";
          return "#000";
        },
        "stroke-width": that.config.labelShadowSize
      });
      var sites = this.treemap.getSites();
      this.polygons.attr({
        fill: function(it,i) {
          if(sites[i].lv == 0) return "none";
          return (that.useColor
            ? that.cScale(sites[i].color) 
            : that.cScale(sites[i].category)
          );
        },
        stroke: this.config.stroke,
        "stroke-width": function(it,i) {
          if(sites[i].lv <= 0) return that.config.strokeWidth;
          return that.config.strokeWidth/3;
        }
      });
    },
    renderTreemap: function() {
      var that = this;
      var sites = this.treemap.getSites();
      var polygons = this.treemap.getPolygons();
      this.polygons.data(polygons).attr({
        d: function(it) {
          if(!it || !it.length) return ""
          ret = ["M", that.xScale(it[0].x), that.yScale(it[0].y)];
          for(var idx = 0; idx < it.length; idx++) {
            ret.push("L");
            ret.push(that.xScale(it[idx].x));
            ret.push(that.yScale(it[idx].y));
          }
          ret.push("L");
          ret.push(that.xScale(it[0].x));
          ret.push(that.yScale(it[0].y));
          return ret.join(" ");
        },
      });
      this.sites.attr({
        transform: function(it,i) {
          var x = 0, y = 0;
          var box = that.polygons[0][i].getBoundingClientRect();
          x = box.left + box.width/2;
          y = box.top + box.height/2;
          if(isNaN(x)) x = -10000;
          if(isNaN(y)) y = -10000;
          return ["translate(", x, y, ")"].join(" ");
        },
      });
    }
  }