(function (Compiler) {
    var TypeScript = require("./typescript.js");
    var CommandLineHost = (function () {
        function CommandLineHost() {
            this.pathMap = {
            };
            this.resolvedPaths = {
            };
        }
        CommandLineHost.prototype.isResolved = function (path) {
            return this.resolvedPaths[this.pathMap[path]] != undefined;
        };
        CommandLineHost.prototype.resolveCompilationEnvironment = function (preEnv, resolver, traceDependencies) {
            var _this = this;
            var resolvedEnv = new TypeScript.CompilationEnvironment(preEnv.compilationSettings, preEnv.ioHost);
            var nCode = preEnv.code.length;
            var nRCode = preEnv.residentCode.length;
            var postResolutionError = function (errorFile, errorMessage) {
                TypeScript.CompilerDiagnostics.debugPrint("Could not resolve file '" + errorFile + "'" + (errorMessage == "" ? "" : ": " + errorMessage));
            };
            var resolutionDispatcher = {
                postResolutionError: postResolutionError,
                postResolution: function (path, code) {
                    if(!_this.resolvedPaths[path]) {
                        resolvedEnv.code.push(code);
                        _this.resolvedPaths[path] = true;
                    }
                }
            };
            var residentResolutionDispatcher = {
                postResolutionError: postResolutionError,
                postResolution: function (path, code) {
                    if(!_this.resolvedPaths[path]) {
                        resolvedEnv.residentCode.push(code);
                        _this.resolvedPaths[path] = true;
                    }
                }
            };
            var path = "";
            for(var i = 0; i < nRCode; i++) {
                path = TypeScript.switchToForwardSlashes(preEnv.ioHost.resolvePath(preEnv.residentCode[i].path));
                this.pathMap[preEnv.residentCode[i].path] = path;
                resolver.resolveCode(path, "", false, residentResolutionDispatcher);
            }
            for(var i = 0; i < nCode; i++) {
                path = TypeScript.switchToForwardSlashes(preEnv.ioHost.resolvePath(preEnv.code[i].path));
                this.pathMap[preEnv.code[i].path] = path;
                resolver.resolveCode(path, "", false, resolutionDispatcher);
            }
            return resolvedEnv;
        };
        return CommandLineHost;
    })();
    Compiler.CommandLineHost = CommandLineHost;    
    var BatchCompiler = (function () {
        function BatchCompiler(ioHost, compilationSettings) {
            this.ioHost = ioHost;
            this.compilationSettings = compilationSettings;
            this.commandLineHost = new CommandLineHost();
            this.resolvedEnvironment = null;
            this.compilationSettings = new TypeScript.CompilationSettings();
            this.compilationEnvironment = new TypeScript.CompilationEnvironment(this.compilationSettings, this.ioHost);
        }
        BatchCompiler.prototype.resolve = function () {
            var resolver = new TypeScript.CodeResolver(this.compilationEnvironment);
            var ret = this.commandLineHost.resolveCompilationEnvironment(this.compilationEnvironment, resolver, true);
            for(var i = 0; i < this.compilationEnvironment.residentCode.length; i++) {
                if(!this.commandLineHost.isResolved(this.compilationEnvironment.residentCode[i].path)) {
                    var path = this.compilationEnvironment.residentCode[i].path;
                    if(!TypeScript.isSTRFile(path) && !TypeScript.isDSTRFile(path) && !TypeScript.isTSFile(path) && !TypeScript.isDTSFile(path)) {
                        this.ioHost.stderr.WriteLine("Unknown extension for file: \"" + path + "\". Only .ts and .d.ts extensions are allowed.");
                    } else {
                        this.ioHost.stderr.WriteLine("Error reading file \"" + path + "\": File not found");
                    }
                }
            }
            for(var i = 0; i < this.compilationEnvironment.code.length; i++) {
                if(!this.commandLineHost.isResolved(this.compilationEnvironment.code[i].path)) {
                    var path = this.compilationEnvironment.code[i].path;
                    if(!TypeScript.isSTRFile(path) && !TypeScript.isDSTRFile(path) && !TypeScript.isTSFile(path) && !TypeScript.isDTSFile(path)) {
                        this.ioHost.stderr.WriteLine("Unknown extension for file: \"" + path + "\". Only .ts and .d.ts extensions are allowed.");
                    } else {
                        this.ioHost.stderr.WriteLine("Error reading file \"" + path + "\": File not found");
                    }
                }
            }
            return ret;
        };
        BatchCompiler.prototype.compile = function () {
            var _this = this;
            if(this.compilationSettings.outputFileName) {
                this.compilationSettings.outputFileName = TypeScript.switchToForwardSlashes(this.ioHost.resolvePath(this.compilationSettings.outputFileName));
            }
            var compiler;
            compiler = new TypeScript.TypeScriptCompiler(this.ioHost.stderr, new TypeScript.NullLogger(), this.compilationSettings);
            compiler.setErrorOutput(this.ioHost.stderr);
            compiler.setErrorCallback(function (minChar, charLen, message, unitIndex) {
                compiler.errorReporter.hasErrors = true;
                var fname = _this.resolvedEnvironment.code[unitIndex].path;
                var lineCol = {
                    line: -1,
                    col: -1
                };
                compiler.parser.getSourceLineCol(lineCol, minChar);
                var msg = fname + " (" + lineCol.line + "," + (lineCol.col + 1) + "): " + message;
                if(_this.compilationSettings.errorRecovery) {
                    _this.ioHost.stderr.WriteLine(msg);
                } else {
                    throw new SyntaxError(msg);
                }
            });
            if(this.compilationSettings.emitComments) {
                compiler.emitCommentsToOutput();
            }
            var consumeUnit = function (code, addAsResident) {
                try  {
                    if(!_this.compilationSettings.resolve) {
                        code.content = _this.ioHost.readFile(code.path);
                        if(_this.compilationSettings.generateDeclarationFiles) {
                            TypeScript.CompilerDiagnostics.assert(code.referencedFiles == null, "With no resolve option, referenced files need to null");
                            code.referencedFiles = TypeScript.getReferencedFiles(code);
                        }
                    }
                    if(code.content) {
                        if(_this.compilationSettings.parseOnly) {
                            compiler.parseUnit(code.content, code.path);
                        } else {
                            if(_this.compilationSettings.errorRecovery) {
                                compiler.parser.setErrorRecovery(_this.ioHost.stderr);
                            }
                            compiler.addUnit(code.content, code.path, addAsResident, code.referencedFiles);
                        }
                    }
                } catch (err) {
                    compiler.errorReporter.hasErrors = true;
                    _this.ioHost.stderr.WriteLine(err.message);
                }
            };
            for(var iResCode = 0; iResCode < this.resolvedEnvironment.residentCode.length; iResCode++) {
                if(!this.compilationSettings.parseOnly) {
                    consumeUnit(this.resolvedEnvironment.residentCode[iResCode], true);
                }
            }
            for(var iCode = 0; iCode < this.resolvedEnvironment.code.length; iCode++) {
                if(!this.compilationSettings.parseOnly || (iCode > 0)) {
                    consumeUnit(this.resolvedEnvironment.code[iCode], false);
                }
            }
            if(!this.compilationSettings.parseOnly) {
                compiler.typeCheck();
                try  {
                    compiler.emit(this.ioHost.createFile);
                } catch (err) {
                    compiler.errorReporter.hasErrors = true;
                    if(err.message != "EmitError") {
                        throw err;
                    }
                }
                compiler.emitDeclarationFile(this.ioHost.createFile);
            } else {
                compiler.emitAST(this.compilationSettings.outputMany, this.ioHost.createFile);
            }
            if(compiler.errorReporter.hasErrors) {
                this.ioHost.quit(1);
            }
        };
        BatchCompiler.prototype.run = function () {
            for(var i = 0; i < this.compilationEnvironment.code.length; i++) {
                var unit = this.compilationEnvironment.code[i];
                var outputFileName = unit.path;
                if(TypeScript.isTSFile(outputFileName)) {
                    outputFileName = outputFileName.replace(/\.ts$/, ".js");
                } else {
                    if(TypeScript.isSTRFile(outputFileName)) {
                        outputFileName = outputFileName.replace(/\.str$/, ".js");
                    }
                }
                if(this.ioHost.fileExists(outputFileName)) {
                    var unitRes = this.ioHost.readFile(outputFileName);
                    this.ioHost.run(unitRes, outputFileName);
                }
            }
        };
        BatchCompiler.prototype.batchCompile = function (sourceUnits) {
            var _this = this;
            TypeScript.CompilerDiagnostics.diagnosticWriter = {
                Alert: function (s) {
                    _this.ioHost.printLine(s);
                }
            };
            var code;
            if(!sourceUnits || sourceUnits.length == 0) {
                throw new Error("sourceUnits is empty");
            }
            if(this.compilationSettings.useDefaultLib) {
                var compilerFilePath = this.ioHost.getExecutingFilePath();
                var binDirPath = this.ioHost.dirName(compilerFilePath);
                var libStrPath = this.ioHost.resolvePath(binDirPath + "/lib.d.ts");
                code = new TypeScript.SourceUnit(libStrPath, null);
                this.compilationEnvironment.code.push(code);
            }
            for(var i = 0; i < sourceUnits.length; i++) {
                this.compilationEnvironment.code.push(sourceUnits[i]);
            }
            this.resolvedEnvironment = this.compilationSettings.resolve ? this.resolve() : this.compilationEnvironment;
            if(this.compilationSettings.watch) {
                var files = [];
                for(var iResCode = 0; iResCode < this.resolvedEnvironment.residentCode.length; iResCode++) {
                    files.push(this.resolvedEnvironment.residentCode[iResCode].path);
                }
                for(var iCode = 0; iCode < this.resolvedEnvironment.code.length; iCode++) {
                    files.push(this.resolvedEnvironment.code[iCode].path);
                }
                if(this.ioHost.watchFiles) {
                    this.ioHost.watchFiles(files, function () {
                        _this.ioHost.printLine("Recompiling(" + new Date() + "): " + files);
                        _this.compilationEnvironment.code = [];
                        for(var i = 0; i < sourceUnits.length; i++) {
                            _this.compilationEnvironment.code.push(sourceUnits[i]);
                        }
                        _this.resolvedEnvironment = _this.compilationSettings.resolve ? _this.resolve() : _this.compilationEnvironment;
                        _this.compile();
                        if(_this.compilationSettings.exec) {
                            _this.run();
                        }
                        _this.ioHost.printLine("");
                    });
                } else {
                    this.ioHost.printLine("Error: Current host does not support -w[atch] option");
                }
            } else {
                this.compile();
                if(this.compilationSettings.exec) {
                    this.run();
                }
            }
        };
        return BatchCompiler;
    })();
    Compiler.BatchCompiler = BatchCompiler;    
})(exports.Compiler || (exports.Compiler = {}));
var Compiler = exports.Compiler;
