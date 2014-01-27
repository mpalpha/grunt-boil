"use strict";

function arrayify(input){
    return Array.isArray(input) ? input : [ input ];
}

function extend(obj, srcObj){
    for (var prop in srcObj){
        obj[prop] = srcObj[prop];
    }
    return obj;
}


module.exports = function(grunt) {

    var handlebars = require("handlebars"),
        path = require("path"),
        FrontMatterExtractor = require("front-matter-extractor"),
        l = console.log;

    function loadModules(helpers, partials){
        if (helpers){
            grunt.file.expand(helpers).forEach(function(helper){
                require(path.resolve(process.cwd(), helper))(handlebars, grunt);
            });
        }
        if (partials){
            grunt.file.expand(partials).forEach(function(partial){
                handlebars.registerPartial(path.basename(partial, ".hbs"), grunt.file.read(partial));
            });
        }
    }

    function File(createItem, content){
        var name = new Content();
        name.template = typeof createItem === "string"
            ? createItem
            : createItem.filename || "";
        name.data = content.data;
        this.name = name.rendered();
        this.copy = createItem.copy;
        this.content = content;
    }
    File.prototype.create = function create(){
        if (this.copy){
            grunt.file.copy(this.copy, this.name);
        } else {
            grunt.file.write(this.name, this.content.rendered());
        }
        grunt.log.ok("created: " + this.name);
    };

    function Content(dataProto){
        this.template = "";
        this.data = Object.create(dataProto || null);
        this.rendered = function(){
            l(this.data);
            if (this.template){
                var compiled = handlebars.compile(this.template);
                return compiled(this.data);
            } else {
                return "";
            }
        };
        this.merge = function(createItem){
            var data = createItem.templateData;
            for (var prop in data){
                if (typeof data[prop] === "string"){
                    var extraction = new FrontMatterExtractor(data[prop]);
                    if (extraction.frontMatter){
                        createItem.templateData[prop] = extraction;
                    }
                }
            }
            this.data = extend(this.data, createItem.templateData);
            this.template = typeof createItem.template === "object"
                ? JSON.stringify(createItem.template, null, "    ")
                : createItem.template;
        };
    }

    grunt.registerMultiTask("boil1", "Boilerplate a new package, page, module, whatever..", function() {
        var options = this.options({
            helpers: [],
            partials: [],
            templateData: {}
        });
        l(this.options());return;
        /*
        Base content object. Loads normalised task & target level options, adds grunt reference
        and command-line args.
        */
        var dataProto = options.templateData;
        dataProto.grunt = grunt;
        if (this.args.length > 0){
            dataProto.args = this.args;
        }

        loadModules(options.helpers, options.partials);

        if (!this.data.create && !this.data.pages){
            var exampleConfig = {
                boil: {
                    something: {
                        create: [ "file1.html", "file2.js", "etc" ]
                    }
                }
            };
            grunt.fail.fatal(
                "You must specify at least one 'create' or 'pages, e.g.: \n\n" +
                JSON.stringify(exampleConfig, null, "    ")
            );
        }

        if (this.data.create){
            arrayify(this.data.create).forEach(function(createItem){
                if (!createItem.template && createItem.templateFile){
                    createItem.template = grunt.file.read(createItem.templateFile);
                }

                var extractor = new FrontMatterExtractor(createItem.template);
                var content = new Content(dataProto);

                createItem.template = extractor.content;
                content.merge(createItem);
                content.data = extend(content.data, extractor.frontMatter);
                var file = new File(createItem, content);
                file.create();
            });
        }
    });
    
    function render(template, data){
        return handlebars.compile(template)(data);
    }

    grunt.registerMultiTask("boil", "blah", function(){
        var self = this,
            options = this.options(),
            mappingData = this.data.data || {},
            data = extend(options.data, mappingData);

        data.args = this.args;
        loadModules(options.helpers, options.partials);
        
        this.files.forEach(function(file){
            var content = "";
            if (file.copy){
                grunt.file.copy(
                    render(file.copy, data), 
                    render(file.dest, data), 
                    { encoding: null }
                );
            } else {
                if (file.src){
                    var extracted = new FrontMatterExtractor(grunt.file.read(file.src[0]));
                    content = extracted.content;
                    data = extend(data, extracted.frontMatter);
                }
                grunt.file.write(render(file.dest, data), render(content, data));
            }
        });
    });
};
