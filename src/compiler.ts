///<reference path="io.ts" />
///<reference path="../vendor/node.d.ts" />
///<reference path="../vendor/typescript.d.ts" />

require("./typescript");

export module Compiler {

    export class CommandLineHost implements TypeScript.IResolverHost {

        public pathMap: any = {};
        public resolvedPaths: any = {};

        public isResolved(path: string) {
            return this.resolvedPaths[this.pathMap[path]] != undefined;
        }

        public resolveCompilationEnvironment(preEnv: TypeScript.CompilationEnvironment,
            resolver: TypeScript.ICodeResolver,
            traceDependencies: bool): TypeScript.CompilationEnvironment {
            var resolvedEnv = new TypeScript.CompilationEnvironment(preEnv.compilationSettings, preEnv.ioHost);

            var nCode = preEnv.code.length;
            var nRCode = preEnv.residentCode.length;

            var postResolutionError =
                (errorFile: string, errorMessage: string) => {
                    TypeScript.CompilerDiagnostics.debugPrint("Could not resolve file '" + errorFile + "'" + (errorMessage == "" ? "" : ": " + errorMessage));
                }

            var resolutionDispatcher: TypeScript.IResolutionDispatcher = {
                postResolutionError: postResolutionError,
                postResolution: (path: string, code: TypeScript.ISourceText) => {
                    if (!this.resolvedPaths[path]) {
                        resolvedEnv.code.push(<TypeScript.SourceUnit>code);
                        this.resolvedPaths[path] = true;
                    }
                }
            };

            var residentResolutionDispatcher: TypeScript.IResolutionDispatcher = {
                postResolutionError: postResolutionError,
                postResolution: (path: string, code: TypeScript.ISourceText) => {
                    if (!this.resolvedPaths[path]) {
                        resolvedEnv.residentCode.push(<TypeScript.SourceUnit>code);
                        this.resolvedPaths[path] = true;
                    }
                }
            };
            var path = "";

            for (var i = 0; i < nRCode; i++) {
                path = TypeScript.switchToForwardSlashes(preEnv.ioHost.resolvePath(preEnv.residentCode[i].path));
                this.pathMap[preEnv.residentCode[i].path] = path;
                resolver.resolveCode(path, "", false, residentResolutionDispatcher);
            }

            for (var i = 0; i < nCode; i++) {
                path = TypeScript.switchToForwardSlashes(preEnv.ioHost.resolvePath(preEnv.code[i].path));
                this.pathMap[preEnv.code[i].path] = path;
                resolver.resolveCode(path, "", false, resolutionDispatcher);
            }

            return resolvedEnv;
        }
    }

    export class BatchCompiler {
        public compilationEnvironment: TypeScript.CompilationEnvironment;
        private commandLineHost = new CommandLineHost();
        public resolvedEnvironment: TypeScript.CompilationEnvironment = null;

        constructor(public ioHost: IIO, public compilationSettings: TypeScript.CompilationSettings) {
            this.compilationSettings = new TypeScript.CompilationSettings();
            this.compilationEnvironment = new TypeScript.CompilationEnvironment(this.compilationSettings, this.ioHost);
        }

        private resolve() {
            var resolver = new TypeScript.CodeResolver(this.compilationEnvironment);
            var ret = this.commandLineHost.resolveCompilationEnvironment(this.compilationEnvironment, resolver, true);

            for (var i = 0; i < this.compilationEnvironment.residentCode.length; i++) {
                if (!this.commandLineHost.isResolved(this.compilationEnvironment.residentCode[i].path)) {
                    var path = this.compilationEnvironment.residentCode[i].path;
                    if (!TypeScript.isSTRFile(path) && !TypeScript.isDSTRFile(path) && !TypeScript.isTSFile(path) && !TypeScript.isDTSFile(path)) {
                        this.ioHost.stderr.WriteLine("Unknown extension for file: \"" + path + "\". Only .ts and .d.ts extensions are allowed.");
                    }
                    else {
                        this.ioHost.stderr.WriteLine("Error reading file \"" + path + "\": File not found");
                    }

                }
            }
            for (var i = 0; i < this.compilationEnvironment.code.length; i++) {
                if (!this.commandLineHost.isResolved(this.compilationEnvironment.code[i].path)) {
                    var path = this.compilationEnvironment.code[i].path;
                    if (!TypeScript.isSTRFile(path) && !TypeScript.isDSTRFile(path) && !TypeScript.isTSFile(path) && !TypeScript.isDTSFile(path)) {
                        this.ioHost.stderr.WriteLine("Unknown extension for file: \"" + path + "\". Only .ts and .d.ts extensions are allowed.");
                    }
                    else {
                        this.ioHost.stderr.WriteLine("Error reading file \"" + path + "\": File not found");
                    }
                }
            }

            return ret;
        }

        /// Do the actual compilation reading from input files and
        /// writing to output file(s).
        private compile() {
            if (this.compilationSettings.outputFileName) {
                this.compilationSettings.outputFileName = TypeScript.switchToForwardSlashes(this.ioHost.resolvePath(this.compilationSettings.outputFileName));
            }
            var compiler: TypeScript.TypeScriptCompiler;

            compiler = new TypeScript.TypeScriptCompiler(this.ioHost.stderr, new TypeScript.NullLogger(), this.compilationSettings);
            compiler.setErrorOutput(this.ioHost.stderr);
            compiler.setErrorCallback(
                (minChar, charLen, message, unitIndex) => {
                    compiler.errorReporter.hasErrors = true;
                    var fname = this.resolvedEnvironment.code[unitIndex].path;
                    var lineCol = { line: -1, col: -1 };
                    compiler.parser.getSourceLineCol(lineCol, minChar);
                    // line is 1-base, col, however, is 0-base. add 1 to the col before printing the message
                    var msg = fname + " (" + lineCol.line + "," + (lineCol.col + 1) + "): " + message;
                    if (this.compilationSettings.errorRecovery) {
                        this.ioHost.stderr.WriteLine(msg);
                    } else {
                        throw new SyntaxError(msg);
                    }
                });

            if (this.compilationSettings.emitComments) {
                compiler.emitCommentsToOutput();
            }

            var consumeUnit = (code: TypeScript.SourceUnit, addAsResident: bool) => {
                try {
                // if file resolving is disabled, the file's content will not yet be loaded

                    if (!this.compilationSettings.resolve) {
                        code.content = this.ioHost.readFile(code.path);
                        // If declaration files are going to be emitted, 
                        // preprocess the file contents and add in referenced files as well
                        if (this.compilationSettings.generateDeclarationFiles) {
                            TypeScript.CompilerDiagnostics.assert(code.referencedFiles == null, "With no resolve option, referenced files need to null");
                            code.referencedFiles = TypeScript.getReferencedFiles(code);
                        }
                    }

                    if (code.content) {
                        if (this.compilationSettings.parseOnly) {
                            compiler.parseUnit(code.content, code.path);
                        }
                        else {
                            if (this.compilationSettings.errorRecovery) {
                                compiler.parser.setErrorRecovery(this.ioHost.stderr);
                            }
                            compiler.addUnit(code.content, code.path, addAsResident, code.referencedFiles);
                        }
                    }
                }
                catch (err) {
                    compiler.errorReporter.hasErrors = true;
                // This includes syntax errors thrown from error callback if not in recovery mode
                    this.ioHost.stderr.WriteLine(err.message);
                }

            }

            for (var iResCode = 0 ; iResCode < this.resolvedEnvironment.residentCode.length; iResCode++) {
                if (!this.compilationSettings.parseOnly) {
                    consumeUnit(this.resolvedEnvironment.residentCode[iResCode], true);
                }
            }

            for (var iCode = 0 ; iCode < this.resolvedEnvironment.code.length; iCode++) {
                if (!this.compilationSettings.parseOnly || (iCode > 0)) {
                    consumeUnit(this.resolvedEnvironment.code[iCode], false);
                }
            }

            if (!this.compilationSettings.parseOnly) {
                compiler.typeCheck();
                try {
                    compiler.emit(this.ioHost.createFile);
                } catch (err) {
                    compiler.errorReporter.hasErrors = true;
                // Catch emitter exceptions
                    if (err.message != "EmitError") {
                        throw err;
                    }
                }

                compiler.emitDeclarationFile(this.ioHost.createFile);
            }
            else {
                compiler.emitAST(this.compilationSettings.outputMany, this.ioHost.createFile);
            }

            if (compiler.errorReporter.hasErrors) {
                this.ioHost.quit(1);
            }
        }

        // Execute the provided inputs
        private run() {
            for (var i = 0; i < this.compilationEnvironment.code.length; i++) {
                var unit = this.compilationEnvironment.code[i];

                var outputFileName: string = unit.path;
                if (TypeScript.isTSFile(outputFileName)) {
                    outputFileName = outputFileName.replace(/\.ts$/, ".js");
                } else if (TypeScript.isSTRFile(outputFileName)) {
                    outputFileName = outputFileName.replace(/\.str$/, ".js");
                }
                if (this.ioHost.fileExists(outputFileName)) {
                    var unitRes = this.ioHost.readFile(outputFileName)
                    this.ioHost.run(unitRes, outputFileName);
                }
            }
        }

        /// Begin batch compilation
        public batchCompile(sourceUnits: TypeScript.SourceUnit[]) {
            TypeScript.CompilerDiagnostics.diagnosticWriter = { Alert: (s: string) => { this.ioHost.printLine(s); } }

            var code: TypeScript.SourceUnit;

            if (!sourceUnits || sourceUnits.length == 0)
                throw new Error("sourceUnits is empty");

            if (this.compilationSettings.useDefaultLib) {
                var compilerFilePath = this.ioHost.getExecutingFilePath()
                var binDirPath = this.ioHost.dirName(compilerFilePath);
                var libStrPath = this.ioHost.resolvePath(binDirPath + "/lib.d.ts");
                code = new TypeScript.SourceUnit(libStrPath, null);
                this.compilationEnvironment.code.push(code);
            }

            for (var i = 0; i < sourceUnits.length; i++) {
                this.compilationEnvironment.code.push(sourceUnits[i]);
            }

            // resolve file dependencies, if requested
            this.resolvedEnvironment = this.compilationSettings.resolve ? this.resolve() : this.compilationEnvironment;

            // REVIEW: Update to use compilation settings / env
            if (this.compilationSettings.watch) {
                var files: string[] = []
                for (var iResCode = 0 ; iResCode < this.resolvedEnvironment.residentCode.length; iResCode++) {
                    files.push(this.resolvedEnvironment.residentCode[iResCode].path);
                }
                for (var iCode = 0 ; iCode < this.resolvedEnvironment.code.length; iCode++) {
                    files.push(this.resolvedEnvironment.code[iCode].path);
                }
                if (this.ioHost.watchFiles) {
                    this.ioHost.watchFiles(files, () => {
                        this.ioHost.printLine("Recompiling(" + new Date() + "): " + files);

                        this.compilationEnvironment.code = [];
                        for (var i = 0; i < sourceUnits.length; i++) {
                            this.compilationEnvironment.code.push(sourceUnits[i]);
                        }

                        // resolve file dependencies, if requested
                        this.resolvedEnvironment = this.compilationSettings.resolve ? this.resolve() : this.compilationEnvironment;

                        this.compile();
                        if (this.compilationSettings.exec) {
                            this.run();
                        }
                        this.ioHost.printLine("");
                    });
                } else {
                    this.ioHost.printLine("Error: Current host does not support -w[atch] option");
                }
            } else {
                this.compile();
                if (this.compilationSettings.exec) {
                    this.run();
                }
            }

        }
    }
}