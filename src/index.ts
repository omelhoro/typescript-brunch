///<reference path="io.ts" />
///<reference path="../vendor/typescript.d.ts" />
///<reference path="../vendor/node.d.ts" />

require("./typescript");
import Compiler = module("Compiler");
import sysPath = module("path");

export class TypeScriptCompiler {
	public brunchPlugin = true;
	public type = "javascript";
	public extension = "ts";
	private compilationSettings: TypeScript.CompilationSettings;
	private libPath: string;

	constructor(public config: any) {
		this.compilationSettings = new TypeScript.CompilationSettings();
		this.compilationSettings.codeGenTarget = TypeScript.CodeGenTarget.ES5;
		this.compilationSettings.moduleGenTarget = TypeScript.ModuleGenTarget.Synchronous;
    	this.compilationSettings.resolve = true;

        this.libPath = sysPath.join(__dirname, "..", "node_modules", "typescript", "bin", "lib.d.ts");
	}

	public compile(data: string, path: string, callback: (error: string, javaScript: string) => any) {
		
        var js = "";
		var error = null;

		var io = IO;
        
		var outputWriter = {
		    Write: function (str) { js += str; },
		    WriteLine: function (str) { js += str + "\n"; },
		    Close: function () { }
		};

        var nullWriter = {
		    Write: function (str) { },
		    WriteLine: function (str) { },
		    Close: function () { }
		};

        path = TypeScript.switchToForwardSlashes(path);
        io.createFile = function (fileName, useUTF8?) {
            if(fileName.match(new RegExp(path.replace(/\.ts$/, ".js")))) {
                return outputWriter;
            } else {
                return nullWriter;
            }
        };

        TypeScript.CompilerDiagnostics.diagnosticWriter = { Alert: (s: string) => { io.printLine(s); } }

		try {
		    var batchCompiler = new Compiler.Compiler.BatchCompiler(io, this.compilationSettings);
		    batchCompiler.batchCompile([
                new TypeScript.SourceUnit(this.libPath, null),
                new TypeScript.SourceUnit(path, data)
                ]);
		}
		catch(err) {
			console.log(err.stack);
			error = err.stack;
		}
		finally {
			callback (error, js);
		}
	}
}

