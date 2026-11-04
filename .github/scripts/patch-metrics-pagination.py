"""Repair pagination and prevent failure-time debug dumps in the pinned image."""

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


def disable_error_diagnostics(source):
    old = '''  //Errors
  catch (error) {
    console.error(error)
    //Print debug buffer if debug was not enabled (if it is, it's already logged on the fly)
    if (!DEBUG) {
      for (const log of [info.break(), "An error occurred, logging debug message :", ...debugged])
        console.log(log)
    }
    core.setFailed(error.message)
    quit("failed")
  }'''
    new = '''  // Keep buffered API/debug data out of public failure logs.
  catch (error) {
    core.setFailed("Metrics failed. Detailed diagnostics are disabled to protect private repository data.")
    quit("failed")
  }'''
    if source.count(old) != 1:
        raise ValueError("Metrics error handler differs from the pinned implementation")
    return source.replace(old, new, 1)


if __name__ == "__main__":
    path = Path(sys.argv[1])
    action_path = Path(sys.argv[2])
    patched = patch(path.read_text())
    quiet_action = disable_error_diagnostics(action_path.read_text())
    path.write_text(patched)
    action_path.write_text(quiet_action)
