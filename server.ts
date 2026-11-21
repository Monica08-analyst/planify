import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: '1mb' }));

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured. Add it in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/ai/workout-plan', async (req, res) => {
  try {
    const {
      goal = 'Balanced strength and mobility',
      fitnessLevel = 'intermediate',
      durationMinutes = 30,
      equipment = 'Bodyweight and light dumbbells',
      energyLevel = 'steady',
      recentSummary = '',
    } = req.body ?? {};

    const ai = getGeminiClient();
    const prompt = [
      `Design a personalized ${durationMinutes}-minute ${fitnessLevel} workout session.`,
      `Primary Goal: ${String(goal).slice(0, 120)}.`,
      `Available Equipment: ${String(equipment).slice(0, 120)}.`,
      `Current Energy Level: ${String(energyLevel).slice(0, 40)}.`,
      recentSummary ? `Recent User Context: ${String(recentSummary).slice(0, 400)}.` : '',
      'Include 5 to 7 purposeful exercises with warm-up, main work, and cool-down.',
      'Keep rationale concise (2 sentences max) and practical.',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are an evidence-based wellness and movement coach. Return structured, safe, realistic workout plans without hype.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: 'Concise workout session title.' },
            rationale: { type: Type.STRING, description: 'Brief 1-2 sentence explanation tailored to user context.' },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  sets: { type: Type.INTEGER },
                  repsOrDuration: { type: Type.STRING },
                  restSeconds: { type: Type.INTEGER },
                  formCue: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    if (!parsed.title || !Array.isArray(parsed.exercises) || parsed.exercises.length === 0) {
      res.status(502).json({ error: 'Received an incomplete workout plan from AI. Please try again.' });
      return;
    }

    res.json({
      title: String(parsed.title).slice(0, 150),
      rationale: String(parsed.rationale ?? '').slice(0, 900),
      exercises: parsed.exercises.slice(0, 12).map((ex: Record<string, unknown>, idx: number) => ({
        id: `ex-${idx + 1}`,
        name: String(ex.name ?? `Movement ${idx + 1}`).slice(0, 100),
        sets: Math.max(1, Math.min(10, Number(ex.sets ?? 3))),
        repsOrDuration: String(ex.repsOrDuration ?? '10 reps').slice(0, 40),
        restSeconds: Math.max(0, Math.min(300, Number(ex.restSeconds ?? 45))),
        formCue: String(ex.formCue ?? 'Move with steady breath control.').slice(0, 180),
        completed: false,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to generate workout plan.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/habit-insights', async (req, res) => {
  try {
    const {
      completionRate = 0,
      activeStreak = 0,
      avgCalories = 0,
      avgActiveMinutes = 0,
      topCategory = 'work',
      missedPatterns = '',
    } = req.body ?? {};

    const ai = getGeminiClient();
    const prompt = [
      'Analyze this user performance snapshot and propose 3 practical, non-overwhelming habit improvements:',
      `- Task completion rate: ${Number(completionRate)}%`,
      `- Active consistency streak: ${Number(activeStreak)} days`,
      `- Average logged intake: ${Number(avgCalories)} kcal/day`,
      `- Average daily movement: ${Number(avgActiveMinutes)} min/day`,
      `- Primary task category: ${String(topCategory).slice(0, 40)}`,
      missedPatterns ? `- Observed friction: ${String(missedPatterns).slice(0, 300)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a behavioral productivity and wellness strategist. Ground every suggestion strictly in the provided metrics. Keep each field concise.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  patternObservation: { type: Type.STRING },
                  suggestedAction: { type: Type.STRING },
                  focusArea: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const validAreas = new Set(['productivity', 'nutrition', 'movement', 'recovery']);
    const list = Array.isArray(parsed.insights) ? parsed.insights.slice(0, 4) : [];

    res.json({
      insights: list.map((item: Record<string, unknown>) => {
        const rawArea = String(item.focusArea ?? 'productivity').toLowerCase();
        return {
          title: String(item.title ?? 'Daily Rhythm Adjustment').slice(0, 140),
          patternObservation: String(item.patternObservation ?? '').slice(0, 450),
          suggestedAction: String(item.suggestedAction ?? '').slice(0, 450),
          focusArea: validAreas.has(rawArea) ? rawArea : 'productivity',
        };
      }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to generate habit insights.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/gift-ideas', async (req, res) => {
  try {
    const {
      personOrEvent = 'Close friend',
      occasionType = 'birthday',
      budget = 75,
      interests = '',
    } = req.body ?? {};

    const ai = getGeminiClient();
    const prompt = [
      `Suggest 4 thoughtful, realistic gift ideas for: ${String(personOrEvent).slice(0, 120)}.`,
      `Occasion: ${String(occasionType).slice(0, 40)}.`,
      `Target budget per gift: around $${Number(budget) || 50}.`,
      interests ? `Notes or interests: ${String(interests).slice(0, 200)}.` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a thoughtful gifting curator. Suggest practical, memorable, non-generic gifts within budget.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ideas: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  estimatedPrice: { type: Type.NUMBER },
                  notes: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const ideas = Array.isArray(parsed.ideas) ? parsed.ideas.slice(0, 6) : [];
    res.json({
      ideas: ideas.map((idea: Record<string, unknown>) => ({
        title: String(idea.title ?? 'Thoughtful Keepsake').slice(0, 120),
        estimatedPrice: Math.max(0, Number(idea.estimatedPrice ?? budget) || 0),
        notes: String(idea.notes ?? '').slice(0, 200),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to generate gift ideas.';
    res.status(500).json({ error: message });
  }
});

app.post('/api/ai/adaptive-schedule', async (req, res) => {
  try {
    const { patternSummary = '', pendingTasks = [] } = req.body ?? {};
    const safeTasks = Array.isArray(pendingTasks) ? pendingTasks.slice(0, 10) : [];
    if (safeTasks.length === 0) {
      res.json({ recommendations: [] });
      return;
    }

    const ai = getGeminiClient();
    const taskLines = safeTasks
      .map(
        (t: Record<string, unknown>) =>
          `- id=${String(t.id)} | title="${String(t.title).slice(0, 100)}" | category=${String(t.category)} | priority=${String(t.priority)} | currentDueTime=${String(t.dueTime || 'unset')}`
      )
      .join('\n');

    const prompt = [
      'Recommend optimal times (24h HH:mm) and reminder lead times (minutes: 10, 15, 30, or 60) for each pending task based strictly on the user’s historical completion peaks, activity logs, and quiet hours.',
      'User Pattern Summary:',
      String(patternSummary).slice(0, 1200),
      'Pending Tasks:',
      taskLines,
      'Avoid quiet hours and avoid overlapping two tasks at the exact same minute.',
    ].join('\n\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a circadian productivity scheduler. Return concise, practical time recommendations in 24h HH:mm format.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  taskId: { type: Type.STRING },
                  suggestedTime: { type: Type.STRING },
                  suggestedOffsetMinutes: { type: Type.INTEGER },
                  rationale: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];
    res.json({
      recommendations: recs.map((r: Record<string, unknown>) => {
        const rawTime = String(r.suggestedTime ?? '09:00').trim();
        const validTime = /^\d{2}:\d{2}$/.test(rawTime) ? rawTime : '09:00';
        const rawOffset = Number(r.suggestedOffsetMinutes ?? 15);
        const safeOffset = [0, 10, 15, 30, 60].includes(rawOffset) ? rawOffset : 15;
        return {
          taskId: String(r.taskId ?? ''),
          suggestedTime: validTime,
          suggestedOffsetMinutes: safeOffset,
          rationale: String(r.rationale ?? '').slice(0, 220),
        };
      }),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to optimize task reminders.';
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Verdant Day server listening on http://0.0.0.0:${port}`);
  });
}

startServer();
