import assert from "node:assert/strict";
import test from "node:test";
import { appendSkill, canonicalSkill, skillSuggestions } from "../../src/lib/skillSuggestions.js";

test("skill suggestions start at three characters, ignore case and prioritize Python", () => {
  assert.deepEqual(skillSuggestions("P"), []);
  assert.deepEqual(skillSuggestions("PY"), []);
  const suggestions = skillSuggestions(" PYT ");
  assert.equal(suggestions[0].label, "Python");
  assert.ok(suggestions.some((skill) => skill.label === "PyTorch"));
  assert.equal(skillSuggestions("PYTHON")[0].label, "Python");
});

test("skill suggestions understand aliases and accents and exclude already selected skills", () => {
  assert.equal(skillSuggestions("nodejs")[0].label, "Node.js");
  assert.ok(skillSuggestions("comunicacao").some((skill) => skill.label === "Comunicação"));
  assert.equal(skillSuggestions("PYT", ["python"]).some((skill) => skill.label === "Python"), false);
  assert.equal(skillSuggestions("react", ["React.js"]).some((skill) => skill.label === "React"), false);
});

test("adding a skill keeps canonical labels, accepts custom skills and rejects duplicates and overflow", () => {
  assert.deepEqual(appendSkill([], "PYTHON"), ["Python"]);
  assert.deepEqual(appendSkill(["Python"], "python"), ["Python"]);
  assert.deepEqual(appendSkill(["React"], "reactjs"), ["React"]);
  assert.deepEqual(appendSkill([], " Minha habilidade "), ["Minha habilidade"]);
  assert.deepEqual(appendSkill([], "  "), []);
  assert.deepEqual(appendSkill([], "x".repeat(61)), []);
  assert.equal(appendSkill(Array.from({ length: 50 }, (_, i) => `Skill ${i}`), "Python").length, 50);
  assert.equal(canonicalSkill("C++"), "C++");
});
