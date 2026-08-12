#!/usr/bin/env python3

import importlib.util
import io
import json
import os
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).with_name("documentation_sync.py")
SPEC = importlib.util.spec_from_file_location("documentation_sync", MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class DocumentationSyncTest(unittest.TestCase):
    def test_message_component_requires_message_documentation(self):
        requirement = MODULE.expected_documentation(
            "packages/vue/src/message/MessageContent.vue"
        )
        self.assertEqual(requirement["docs"], {"packages/docs/components/message.md"})

    def test_tests_and_internal_utils_do_not_require_documentation(self):
        self.assertIsNone(
            MODULE.expected_documentation(
                "packages/markdown/src/MarkdownRenderer.test.ts"
            )
        )
        self.assertIsNone(
            MODULE.expected_documentation("packages/vue/src/utils/format.ts")
        )

    def test_matching_documentation_satisfies_requirement(self):
        missing = MODULE.missing_documentation(
            {
                "packages/core/src/composables/index.ts",
                "packages/docs/composables/use-chat.md",
            }
        )
        self.assertEqual(missing, [])

    def test_unrelated_documentation_does_not_satisfy_component(self):
        missing = MODULE.missing_documentation(
            {
                "packages/vue/src/tool-call/ToolCall.vue",
                "packages/docs/components/message.md",
            }
        )
        self.assertEqual(len(missing), 1)
        self.assertEqual(missing[0]["label"], "Vue 组件 ToolCall.vue")

    def test_package_manifest_accepts_installation_documentation(self):
        missing = MODULE.missing_documentation(
            {
                "packages/markdown/package.json",
                "packages/docs/guide/installation.md",
            }
        )
        self.assertEqual(missing, [])

    def test_theme_tokens_require_theming_documentation(self):
        requirement = MODULE.expected_documentation(
            "packages/vue/src/styles/tokens.css"
        )
        self.assertIn("packages/docs/guide/theming.md", requirement["docs"])

    def test_core_utils_require_public_api_documentation(self):
        requirement = MODULE.expected_documentation("packages/core/src/utils/index.ts")
        self.assertEqual(requirement["label"], "@ai-chat/core 公共 API")

    def test_session_end_blocks_when_documentation_is_missing(self):
        output = io.StringIO()
        with (
            patch.object(MODULE, "load_state", return_value={"baseline": "abc"}),
            patch.object(
                MODULE,
                "changed_files",
                return_value={"packages/vue/src/message/Message.vue"},
            ),
            redirect_stdout(output),
        ):
            MODULE.session_end({})

        result = json.loads(output.getvalue())
        self.assertFalse(result["continue"])
        self.assertIn("packages/docs/components/message.md", result["stopReason"])

    def test_session_end_allows_explicit_acknowledgement(self):
        output = io.StringIO()
        with (
            patch.object(
                MODULE,
                "load_state",
                return_value={"baseline": "abc", "acknowledgement": "仅内部修复"},
            ),
            patch.object(
                MODULE,
                "changed_files",
                return_value={"packages/vue/src/message/Message.vue"},
            ),
            redirect_stdout(output),
        ):
            MODULE.session_end({})

        result = json.loads(output.getvalue())
        self.assertNotIn("continue", result)
        self.assertIn("仅内部修复", result["systemMessage"])

    def test_pre_commit_blocks_git_commit_when_documentation_is_missing(self):
        output = io.StringIO()
        event = {"tool_input": {"cmd": "git commit -m 'feat: test'"}}
        with (
            patch.object(MODULE, "load_state", return_value={"baseline": "abc"}),
            patch.object(
                MODULE,
                "session_changed_files",
                return_value={"packages/vue/src/message/Message.vue"},
            ),
            redirect_stdout(output),
        ):
            MODULE.pre_commit(event)

        result = json.loads(output.getvalue())
        self.assertEqual(result["decision"], "block")

    def test_pre_commit_ignores_non_commit_commands(self):
        output = io.StringIO()
        event = {"tool_input": {"cmd": "git status --short"}}
        with redirect_stdout(output):
            MODULE.pre_commit(event)
        self.assertEqual(output.getvalue(), "")

    def test_preexisting_unchanged_file_is_ignored(self):
        state = {
            "baseline": "abc",
            "initial_files": {"packages/vue/src/message/Message.vue": "same"},
        }
        with (
            patch.object(
                MODULE,
                "changed_files",
                return_value={"packages/vue/src/message/Message.vue"},
            ),
            patch.object(MODULE, "file_fingerprint", return_value="same"),
        ):
            self.assertEqual(MODULE.session_changed_files(state), set())

    def test_preexisting_file_changed_again_is_checked(self):
        state = {
            "baseline": "abc",
            "initial_files": {"packages/vue/src/message/Message.vue": "before"},
        }
        with (
            patch.object(
                MODULE,
                "changed_files",
                return_value={"packages/vue/src/message/Message.vue"},
            ),
            patch.object(MODULE, "file_fingerprint", return_value="after"),
        ):
            self.assertEqual(
                MODULE.session_changed_files(state),
                {"packages/vue/src/message/Message.vue"},
            )

    def test_state_file_uses_codex_thread_id(self):
        with patch.dict(os.environ, {"CODEX_THREAD_ID": "thread/123"}):
            self.assertEqual(
                MODULE.state_file().name,
                "documentation-sync-thread-123.json",
            )


if __name__ == "__main__":
    unittest.main()
