"""Repair pagination in the pinned Metrics image without rebuilding its dependencies."""

from pathlib import Path
import sys


def patch(source):
    replacements = {
        '        do {\n          console.debug(`metrics/compute/${login}/base > retrieving':
            '        while (data.user[type].nodes.length < repositories) {\n'
            '          const batch = Math.min(repositories - data.user[type].nodes.length, {user: _batch, organization: Math.min(25, _batch)}[account])\n'
            '          console.debug(`metrics/compute/${login}/base > retrieving',
        'repositories: Math.min(repositories, {user: _batch, organization: Math.min(25, _batch)}[account]), ...options':
            'repositories: batch, ...options',
        '          if (pushed < repositories) {':
            '          if ((pushed < batch) || (!cursor)) {',
        '        while ((pushed) && (cursor) && ((data.user.repositories?.nodes?.length ?? 0) + (data.user.repositoriesContributedTo?.nodes?.length ?? 0) < repositories))\n':
            '',
    }
    for old, new in replacements.items():
        if source.count(old) != 1:
            raise ValueError("Metrics source differs from the pinned pagination implementation")
        source = source.replace(old, new, 1)
    return source


if __name__ == "__main__":
    path = Path(sys.argv[1])
    path.write_text(patch(path.read_text()))
