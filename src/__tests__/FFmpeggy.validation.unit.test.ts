import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FFmpeggy } from "#/FFmpeggy.js";
import {
  configureFFmpeggy,
  SAMPLE_FILES,
  TestFileManager,
} from "./utils/testHelpers.js";

// Configure FFmpeggy with binaries
configureFFmpeggy();

describe("FFmpeggy:validation", () => {
  const fileManager = new TestFileManager("validation");

  beforeAll(async () => {
    await fileManager.setup();
  });

  afterAll(async () => {
    await fileManager.cleanup();
  });

  describe("Constructor validation", () => {
    describe("Incompatible combinations", () => {
      it("should throw error when using both input and inputs", () => {
        expect(() => {
          // Test runtime validation by creating an object with both properties
          const invalidOptions = {
            input: "input.mp4",
            inputs: ["input1.mp4", "input2.mp4"],
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          new FFmpeggy(invalidOptions as any);
        }).toThrow(
          "Cannot use both 'input' and 'inputs' options. Use either 'input' for single input or 'inputs' for multiple inputs."
        );
      });

      it("should throw error when using both output and outputs", () => {
        expect(() => {
          // Test runtime validation by creating an object with both properties
          const invalidOptions = {
            output: "output.mp4",
            outputs: [
              { destination: "output1.mp4", options: ["-c:v", "libx264"] },
              { destination: "output2.mp4", options: ["-c:v", "libx265"] },
            ],
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          new FFmpeggy(invalidOptions as any);
        }).toThrow(
          "Cannot use both 'output' and 'outputs' options. Use either 'output' for single output or 'outputs' for multiple outputs."
        );
      });

      it("should throw error when using both input, inputs, output, and outputs", () => {
        expect(() => {
          // Test runtime validation by creating an object with all conflicting properties
          const invalidOptions = {
            input: "input.mp4",
            inputs: ["input1.mp4", "input2.mp4"],
            output: "output.mp4",
            outputs: [
              { destination: "output1.mp4", options: ["-c:v", "libx264"] },
              { destination: "output2.mp4", options: ["-c:v", "libx265"] },
            ],
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          new FFmpeggy(invalidOptions as any);
        }).toThrow(
          "Cannot use both 'input' and 'inputs' options. Use either 'input' for single input or 'inputs' for multiple inputs."
        );
      });
    });

    describe("Valid combinations", () => {
      it("should accept single input and single output", () => {
        const ffmpeggy = new FFmpeggy({
          input: "input.mp4",
          output: "output.mp4",
        });
        expect(ffmpeggy.inputs).toEqual(["input.mp4"]);
        expect(ffmpeggy.outputs).toEqual(["output.mp4"]);
      });

      it("should accept single input and multiple outputs", () => {
        const ffmpeggy = new FFmpeggy({
          input: "input.mp4",
          outputs: [
            { destination: "output1.mp4", options: ["-c:v", "libx264"] },
            { destination: "output2.mp4", options: ["-c:v", "libx265"] },
          ],
        });
        expect(ffmpeggy.inputs).toEqual(["input.mp4"]);
        expect(ffmpeggy.outputs).toEqual([
          { destination: "output1.mp4", options: ["-c:v", "libx264"] },
          { destination: "output2.mp4", options: ["-c:v", "libx265"] },
        ]);
      });

      it("should accept multiple inputs and single output", () => {
        const ffmpeggy = new FFmpeggy({
          inputs: ["input1.mp4", "input2.mp4"],
          output: "output.mp4",
        });
        expect(ffmpeggy.inputs).toEqual(["input1.mp4", "input2.mp4"]);
        expect(ffmpeggy.outputs).toEqual(["output.mp4"]);
      });

      it("should accept multiple inputs and multiple outputs", () => {
        const ffmpeggy = new FFmpeggy({
          inputs: ["input1.mp4", "input2.mp4"],
          outputs: [
            { destination: "output1.mp4", options: ["-c:v", "libx264"] },
            { destination: "output2.mp4", options: ["-c:v", "libx265"] },
          ],
        });
        expect(ffmpeggy.inputs).toEqual(["input1.mp4", "input2.mp4"]);
        expect(ffmpeggy.outputs).toEqual([
          { destination: "output1.mp4", options: ["-c:v", "libx264"] },
          { destination: "output2.mp4", options: ["-c:v", "libx265"] },
        ]);
      });

      it("should accept empty options object", () => {
        const ffmpeggy = new FFmpeggy({});
        expect(ffmpeggy.inputs).toEqual([]);
        expect(ffmpeggy.outputs).toEqual([]);
      });

      it("should accept options with only non-input/output properties", () => {
        const ffmpeggy = new FFmpeggy({
          cwd: "/tmp",
          overwriteExisting: true,
          hideBanner: false,
          globalOptions: ["-loglevel", "info"],
        });
        expect(ffmpeggy.cwd).toBe("/tmp");
        expect(ffmpeggy.overwriteExisting).toBe(true);
        expect(ffmpeggy.hideBanner).toBe(false);
        expect(ffmpeggy.globalOptions).toContain("-loglevel");
        expect(ffmpeggy.globalOptions).toContain("info");
      });
    });
  });

  describe("Method validation", () => {
    describe("setInput validation", () => {
      it("should allow setInput when no inputs are configured", () => {
        const ffmpeggy = new FFmpeggy();
        expect(() => {
          ffmpeggy.setInput("input.mp4");
        }).not.toThrow();
        expect(ffmpeggy.inputs).toEqual(["input.mp4"]);
      });

      it("should allow setInput when single input is already configured", () => {
        const ffmpeggy = new FFmpeggy({ input: "input1.mp4" });
        expect(() => {
          ffmpeggy.setInput("input2.mp4");
        }).not.toThrow();
        expect(ffmpeggy.inputs).toEqual(["input2.mp4"]);
      });

      it("should throw error when setInput is called with multiple inputs configured", () => {
        const ffmpeggy = new FFmpeggy({
          inputs: ["input1.mp4", "input2.mp4"],
        });
        expect(() => {
          ffmpeggy.setInput("input3.mp4");
        }).toThrow(
          "Cannot use setInput() when multiple inputs are already configured. Use setInputs() or clearInputs() first."
        );
      });

      it("should allow setInput when multiple outputs are configured", () => {
        const ffmpeggy = new FFmpeggy({
          outputs: [
            { destination: "output1.mp4", options: ["-c:v", "libx264"] },
            { destination: "output2.mp4", options: ["-c:v", "libx265"] },
          ],
        });
        expect(() => {
          ffmpeggy.setInput("input.mp4");
        }).not.toThrow();
        expect(ffmpeggy.inputs).toEqual(["input.mp4"]);
      });
    });

    describe("setInputs validation", () => {
      it("should allow setInputs when no inputs are configured", () => {
        const ffmpeggy = new FFmpeggy();
        expect(() => {
          ffmpeggy.setInputs(["input1.mp4", "input2.mp4"]);
        }).not.toThrow();
        expect(ffmpeggy.inputs).toEqual(["input1.mp4", "input2.mp4"]);
      });

      it("should allow setInputs when single input is already configured and new inputs is single", () => {
        const ffmpeggy = new FFmpeggy({ input: "input1.mp4" });
        expect(() => {
          ffmpeggy.setInputs(["input2.mp4"]);
        }).not.toThrow();
        expect(ffmpeggy.inputs).toEqual(["input2.mp4"]);
      });

      it("should allow setInputs when called with multiple inputs when single input is configured", () => {
        const ffmpeggy = new FFmpeggy({ input: "input1.mp4" });
        expect(() => {
          ffmpeggy.setInputs(["input2.mp4", "input3.mp4"]);
        }).not.toThrow();
        expect(ffmpeggy.inputs).toEqual(["input2.mp4", "input3.mp4"]);
      });

      it("should allow setInputs when multiple inputs are already configured", () => {
        const ffmpeggy = new FFmpeggy({
          inputs: ["input1.mp4", "input2.mp4"],
        });
        expect(() => {
          ffmpeggy.setInputs(["input3.mp4", "input4.mp4"]);
        }).not.toThrow();
        expect(ffmpeggy.inputs).toEqual(["input3.mp4", "input4.mp4"]);
      });

      it("should allow setInputs when single output is configured", () => {
        const ffmpeggy = new FFmpeggy({ output: "output.mp4" });
        expect(() => {
          ffmpeggy.setInputs(["input1.mp4", "input2.mp4"]);
        }).not.toThrow();
        expect(ffmpeggy.inputs).toEqual(["input1.mp4", "input2.mp4"]);
      });
    });

    describe("setOutput validation", () => {
      it("should allow setOutput when no outputs are configured", () => {
        const ffmpeggy = new FFmpeggy();
        expect(() => {
          ffmpeggy.setOutput("output.mp4");
        }).not.toThrow();
        expect(ffmpeggy.outputs).toEqual(["output.mp4"]);
      });

      it("should allow setOutput when single output is already configured", () => {
        const ffmpeggy = new FFmpeggy({ output: "output1.mp4" });
        expect(() => {
          ffmpeggy.setOutput("output2.mp4");
        }).not.toThrow();
        expect(ffmpeggy.outputs).toEqual(["output2.mp4"]);
      });

      it("should throw error when setOutput is called with multiple outputs configured", () => {
        const ffmpeggy = new FFmpeggy({
          outputs: [
            { destination: "output1.mp4", options: ["-c:v", "libx264"] },
            { destination: "output2.mp4", options: ["-c:v", "libx265"] },
          ],
        });
        expect(() => {
          ffmpeggy.setOutput("output3.mp4");
        }).toThrow(
          "Cannot use setOutput() when multiple outputs are already configured. Use setOutputs() or clearOutputs() first."
        );
      });

      it("should allow setOutput when multiple inputs are configured", () => {
        const ffmpeggy = new FFmpeggy({
          inputs: ["input1.mp4", "input2.mp4"],
        });
        expect(() => {
          ffmpeggy.setOutput("output.mp4");
        }).not.toThrow();
        expect(ffmpeggy.outputs).toEqual(["output.mp4"]);
      });
    });

    describe("setOutputs validation", () => {
      it("should allow setOutputs when no outputs are configured", () => {
        const ffmpeggy = new FFmpeggy();
        expect(() => {
          ffmpeggy.setOutputs([
            { destination: "output1.mp4", options: ["-c:v", "libx264"] },
            { destination: "output2.mp4", options: ["-c:v", "libx265"] },
          ]);
        }).not.toThrow();
        expect(ffmpeggy.outputs).toEqual([
          { destination: "output1.mp4", options: ["-c:v", "libx264"] },
          { destination: "output2.mp4", options: ["-c:v", "libx265"] },
        ]);
      });

      it("should allow setOutputs when single output is already configured and new outputs is single", () => {
        const ffmpeggy = new FFmpeggy({ output: "output1.mp4" });
        expect(() => {
          ffmpeggy.setOutputs(["output2.mp4"]);
        }).not.toThrow();
        expect(ffmpeggy.outputs).toEqual(["output2.mp4"]);
      });

      it("should allow setOutputs when called with multiple outputs when single output is configured", () => {
        const ffmpeggy = new FFmpeggy({ output: "output1.mp4" });
        expect(() => {
          ffmpeggy.setOutputs([
            { destination: "output2.mp4", options: ["-c:v", "libx264"] },
            { destination: "output3.mp4", options: ["-c:v", "libx265"] },
          ]);
        }).not.toThrow();
        expect(ffmpeggy.outputs).toEqual([
          { destination: "output2.mp4", options: ["-c:v", "libx264"] },
          { destination: "output3.mp4", options: ["-c:v", "libx265"] },
        ]);
      });

      it("should allow setOutputs when multiple outputs are already configured", () => {
        const ffmpeggy = new FFmpeggy({
          outputs: [
            { destination: "output1.mp4", options: ["-c:v", "libx264"] },
            { destination: "output2.mp4", options: ["-c:v", "libx265"] },
          ],
        });
        expect(() => {
          ffmpeggy.setOutputs([
            { destination: "output3.mp4", options: ["-c:v", "libx264"] },
            { destination: "output4.mp4", options: ["-c:v", "libx265"] },
          ]);
        }).not.toThrow();
        expect(ffmpeggy.outputs).toEqual([
          { destination: "output3.mp4", options: ["-c:v", "libx264"] },
          { destination: "output4.mp4", options: ["-c:v", "libx265"] },
        ]);
      });

      it("should allow setOutputs when single input is configured", () => {
        const ffmpeggy = new FFmpeggy({ input: "input.mp4" });
        expect(() => {
          ffmpeggy.setOutputs([
            { destination: "output1.mp4", options: ["-c:v", "libx264"] },
            { destination: "output2.mp4", options: ["-c:v", "libx265"] },
          ]);
        }).not.toThrow();
        expect(ffmpeggy.outputs).toEqual([
          { destination: "output1.mp4", options: ["-c:v", "libx264"] },
          { destination: "output2.mp4", options: ["-c:v", "libx265"] },
        ]);
      });
    });

    describe("clearInputs and clearOutputs", () => {
      it("should allow setInput after clearInputs", () => {
        const ffmpeggy = new FFmpeggy({
          inputs: ["input1.mp4", "input2.mp4"],
        });
        ffmpeggy.clearInputs();
        expect(() => {
          ffmpeggy.setInput("input3.mp4");
        }).not.toThrow();
        expect(ffmpeggy.inputs).toEqual(["input3.mp4"]);
      });

      it("should allow setInputs after clearInputs", () => {
        const ffmpeggy = new FFmpeggy({ input: "input1.mp4" });
        ffmpeggy.clearInputs();
        expect(() => {
          ffmpeggy.setInputs(["input2.mp4", "input3.mp4"]);
        }).not.toThrow();
        expect(ffmpeggy.inputs).toEqual(["input2.mp4", "input3.mp4"]);
      });

      it("should allow setOutput after clearOutputs", () => {
        const ffmpeggy = new FFmpeggy({
          outputs: [
            { destination: "output1.mp4", options: ["-c:v", "libx264"] },
            { destination: "output2.mp4", options: ["-c:v", "libx265"] },
          ],
        });
        ffmpeggy.clearOutputs();
        expect(() => {
          ffmpeggy.setOutput("output3.mp4");
        }).not.toThrow();
        expect(ffmpeggy.outputs).toEqual(["output3.mp4"]);
      });

      it("should allow setOutputs after clearOutputs", () => {
        const ffmpeggy = new FFmpeggy({ output: "output1.mp4" });
        ffmpeggy.clearOutputs();
        expect(() => {
          ffmpeggy.setOutputs([
            { destination: "output2.mp4", options: ["-c:v", "libx264"] },
            { destination: "output3.mp4", options: ["-c:v", "libx265"] },
          ]);
        }).not.toThrow();
        expect(ffmpeggy.outputs).toEqual([
          { destination: "output2.mp4", options: ["-c:v", "libx264"] },
          { destination: "output3.mp4", options: ["-c:v", "libx265"] },
        ]);
      });
    });

    describe("addInput and addOutput", () => {
      it("should allow addInput to work with any input configuration", () => {
        const ffmpeggy = new FFmpeggy();

        // Add to empty
        ffmpeggy.addInput("input1.mp4");
        expect(ffmpeggy.inputs).toEqual(["input1.mp4"]);

        // Add to single
        ffmpeggy.addInput("input2.mp4");
        expect(ffmpeggy.inputs).toEqual(["input1.mp4", "input2.mp4"]);

        // Add to multiple
        ffmpeggy.addInput("input3.mp4");
        expect(ffmpeggy.inputs).toEqual([
          "input1.mp4",
          "input2.mp4",
          "input3.mp4",
        ]);
      });

      it("should allow addOutput to work with any output configuration", () => {
        const ffmpeggy = new FFmpeggy();

        // Add to empty
        ffmpeggy.addOutput("output1.mp4");
        expect(ffmpeggy.outputs).toEqual(["output1.mp4"]);

        // Add to single
        ffmpeggy.addOutput("output2.mp4");
        expect(ffmpeggy.outputs).toEqual(["output1.mp4", "output2.mp4"]);

        // Add to multiple
        ffmpeggy.addOutput("output3.mp4");
        expect(ffmpeggy.outputs).toEqual([
          "output1.mp4",
          "output2.mp4",
          "output3.mp4",
        ]);
      });
    });
  });

  describe("run() validation", () => {
    it("should throw error if no input specified", async () => {
      const ffmpeggy = new FFmpeggy({ output: "output.mp4" });
      await expect(ffmpeggy.run()).rejects.toThrow("No input specified");
    });

    it("should throw error if input is an empty string", async () => {
      const ffmpeggy = new FFmpeggy({ input: "", output: "output.mp4" });
      await expect(ffmpeggy.run()).rejects.toThrow("No input specified");
    });

    it("should throw error if output is not specified", async () => {
      const ffmpeggy = new FFmpeggy({ input: SAMPLE_FILES.video_basic_mp4 });
      await expect(ffmpeggy.run()).rejects.toThrow("No output specified");
    });

    it("should throw error if output is an empty string", async () => {
      const ffmpeggy = new FFmpeggy({
        input: SAMPLE_FILES.video_basic_mp4,
        output: "",
      });
      await expect(ffmpeggy.run()).rejects.toThrow("No output specified");
    });

    it("should throw error if input file does not exist (after empty checks)", async () => {
      const ffmpeggy = new FFmpeggy({
        input: "nonexistent_file.mp4",
        output: "output.mp4",
      });
      await expect(ffmpeggy.run()).rejects.toThrow(
        "Input file does not exist: nonexistent_file.mp4"
      );
    });
  });

  describe("Integration with actual FFmpeg operations", () => {
    it("should work with single input and multiple outputs", async () => {
      const ffmpeggy = new FFmpeggy({
        input: SAMPLE_FILES.video_basic_mp4,
        outputs: [
          {
            destination: fileManager.createTempFile("mp4"),
            options: ["-c:v", "libx264"],
          },
          {
            destination: fileManager.createTempFile("mp4"),
            options: ["-c:v", "libx264"],
          },
        ],
      });

      // Should not throw validation errors
      expect(() => {
        ffmpeggy.run();
      }).not.toThrow();

      // Clean up
      await ffmpeggy.stop();
    });

    it("should work with multiple inputs and single output", async () => {
      const ffmpeggy = new FFmpeggy({
        inputs: [SAMPLE_FILES.video_basic_mp4, SAMPLE_FILES.audio_basic_mp3],
        output: fileManager.createTempFile("mp4"),
      });

      // Should not throw validation errors
      expect(() => {
        ffmpeggy.run();
      }).not.toThrow();

      // Clean up
      await ffmpeggy.stop();
    });

    it("should work with method chaining for mixed configurations", () => {
      const ffmpeggy = new FFmpeggy()
        .setInput(SAMPLE_FILES.video_basic_mp4)
        .setOutputs([
          {
            destination: fileManager.createTempFile("mp4"),
            options: ["-c:v", "libx264"],
          },
          {
            destination: fileManager.createTempFile("mp4"),
            options: ["-c:v", "libx264"],
          },
        ]);

      expect(ffmpeggy.inputs).toEqual([SAMPLE_FILES.video_basic_mp4]);
      expect(ffmpeggy.outputs).toHaveLength(2);
    });
  });
});
