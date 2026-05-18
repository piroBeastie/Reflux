/**
 * agentRunner.js
 * Runs the autonomous Gemini function-calling loop against simulated MCP tools.
 */

const { chatCompletion } = require('./llmService');
const { executeTool } = require('./toolExecutor');
const { logStep } = require('./traceLogger');
const { mcpToolsToGemini } = require('../utils/schemaUtils');

const MAX_ITERATIONS = 8;

function buildSystemPrompt(tools) {
  const toolList = tools.map((t) => `${t.name}: ${t.description}`).join('\n');
  return `Complete the task using these tools. Use exact parameter names from schemas. On failure, fix args and retry. Reply with a short summary when done.\n\nTools:\n${toolList}`;
}

function parseArgs(raw) {
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw || {};
  } catch {
    return {};
  }
}

function isRetry(steps, toolName, args) {
  const key = JSON.stringify({ tool: toolName, args });
  return steps.some((s) => JSON.stringify({ tool: s.tool, args: s.args }) === key);
}

/**
 * Extract text and function calls from Gemini response parts.
 */
function parseResponse(parts) {
  let text = null;
  const functionCalls = [];

  for (const part of parts) {
    if (part.text) text = (text || '') + part.text;
    if (part.functionCall) {
      functionCalls.push({
        name: part.functionCall.name,
        args: part.functionCall.args || {},
        thoughtSignature: part.thoughtSignature || undefined,
      });
    }
  }

  return { text, functionCalls };
}

async function runAgent({ task, tools, session, stress = false, mode = 'simulated' }) {
  const geminiTools = mcpToolsToGemini(tools);
  const systemInstruction = buildSystemPrompt(tools);
  const contents = [
    { role: 'user', parts: [{ text: task }] },
  ];

  let finished = false;
  let iterations = 0;
  let finalResponse = null;
  let lockedModel = null;

  while (!finished && iterations < MAX_ITERATIONS) {
    iterations++;

    const result = await chatCompletion({
      systemInstruction,
      contents,
      tools: geminiTools,
      _lockedModel: lockedModel,
    });

    if (result._usedModel && !lockedModel) {
      lockedModel = result._usedModel;
    }

    const { text, functionCalls } = parseResponse(result.parts);

    if (functionCalls.length === 0) {
      finished = true;
      finalResponse = text;
      if (text) {
        contents.push({ role: 'model', parts: [{ text }] });
      }
      break;
    }

    // Add model response (text + function calls) to conversation
    const modelParts = [];
    if (text) modelParts.push({ text });
    for (const fc of functionCalls) {
      const callPart = { functionCall: { name: fc.name, args: fc.args } };
      if (fc.thoughtSignature) callPart.thoughtSignature = fc.thoughtSignature;
      modelParts.push(callPart);
    }
    contents.push({ role: 'model', parts: modelParts });

    // Execute each function call and collect responses
    const responseParts = [];
    for (const fc of functionCalls) {
      const toolDef = tools.find((t) => t.name === fc.name);

      if (!toolDef) {
        logStep(session, {
          tool: fc.name,
          args: fc.args,
          success: false,
          error: `Unknown tool: ${fc.name}`,
          is_retry: false,
          latency_ms: 0,
        });
        responseParts.push({
          functionResponse: { name: fc.name, response: { error: `Unknown tool: ${fc.name}` } },
        });
        continue;
      }

      const retry = isRetry(session.steps, fc.name, fc.args);
      const execResult = await executeTool(toolDef, fc.args, { stress, mode });

      logStep(session, {
        tool: fc.name,
        args: fc.args,
        output: execResult.output,
        success: execResult.success,
        error: execResult.error,
        is_retry: retry,
        latency_ms: execResult.latency_ms,
      });

      responseParts.push({
        functionResponse: {
          name: fc.name,
          response: execResult.success
            ? { success: true, data: execResult.output }
            : { success: false, error: execResult.error },
        },
      });
    }

    // Tool responses go as a user message in Gemini
    contents.push({ role: 'user', parts: responseParts });
  }

  const successSteps = session.steps.filter((s) => s.success).length;
  const totalSteps = session.steps.length;
  const workflowSuccess = finished && successSteps > 0 && session.steps.every((s) => s.success);

  const taskCompleted = Boolean(
    finished && finalResponse && String(finalResponse).trim().length > 0
  );
  const taskCompletedSuccessfully = taskCompleted && workflowSuccess;

  return {
    finished,
    iterations,
    finalResponse,
    workflowSuccess,
    taskCompleted,
    taskCompletedSuccessfully,
    agentFinalResponse: finalResponse,
    successRate: totalSteps > 0 ? successSteps / totalSteps : 0,
    steps: session.steps,
  };
}

module.exports = {
  runAgent,
  buildSystemPrompt,
  MAX_ITERATIONS,
};
